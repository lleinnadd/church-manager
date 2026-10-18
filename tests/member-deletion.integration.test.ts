import { execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import * as h3 from 'h3';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { PermissionAction, PermissionScopeType, Prisma } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserPermissionContext } from '../shared/types/rbac';

const { deleteUser, deleteBlob } = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  deleteBlob: vi.fn(),
}));

function signingSecret() {
  return `whsec_${Buffer.from('member-deletion-test-signing-key').toString('base64')}`;
}

function clerkError(status: number, code: string) {
  const require = createRequire(import.meta.url);
  const clerkRequire = createRequire(require.resolve('@clerk/nuxt'));
  const { ClerkAPIResponseError } = clerkRequire('@clerk/shared/error');
  return new ClerkAPIResponseError('Clerk test error', { status, data: [{ code, message: code }] });
}

vi.mock('@clerk/nuxt/server', () => ({
  clerkClient: () => ({ users: { deleteUser } }),
  clerkMiddleware: (handler: h3.EventHandler) => handler,
  createRouteMatcher:
    ([pattern]: string[]) =>
    (event: h3.H3Event) =>
      h3
        .getRequestURL(event)
        .pathname.startsWith(pattern?.includes('webhook') ? '/api/webhook' : '/api/'),
}));

// Exercise Clerk's real signature verification without requiring Nuxt runtime aliases.
vi.mock('@clerk/nuxt/webhooks', async () => {
  const require = createRequire(import.meta.url);
  const backendPath = require.resolve('@clerk/backend/webhooks', {
    paths: [dirname(require.resolve('@clerk/nuxt'))],
  });
  const backend = await import(backendPath);
  return {
    verifyWebhook: (event: h3.H3Event) =>
      backend.verifyWebhook(h3.toWebRequest(event), { signingSecret: signingSecret() }),
  };
});

vi.mock('@vercel/blob', () => ({ del: deleteBlob, put: vi.fn() }));

let database: MongoMemoryReplSet;
let prisma: typeof import('../server/utils/prisma').default;
let service: typeof import('../server/utils/member-deletion');
let server: Server;
let origin: string;
let memberId: string;
let congregationId: string;
let departmentId: string;
let permissions: typeof import('../server/utils/rbac');

function permissionContext(role: string): UserPermissionContext {
  return {
    memberId: 'staff',
    clerkUserId: role === 'self' ? 'user_linked' : 'user_staff',
    congregationId,
    isAdmin: false,
    isGlobal: false,
    hasAnyPermission: true,
    allowedCongregationIds: role === 'outside' ? [] : [congregationId],
    permissions: [
      {
        resource: 'members',
        action: role === 'reader' ? PermissionAction.READ : PermissionAction.DELETE,
        scopeType: PermissionScopeType.OWN_CONGREGATION,
      },
    ],
  };
}

function remove(role = 'staff') {
  return fetch(`${origin}/api/members/${memberId}`, {
    method: 'DELETE',
    headers: role ? { 'x-test-role': role } : {},
  });
}

function webhook(
  payload: unknown = { type: 'user.deleted', data: { id: 'user_linked' } },
  valid = true,
) {
  const body = JSON.stringify(payload);
  const id = 'msg_member_deletion';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', Buffer.from(signingSecret().slice(6), 'base64'))
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return fetch(`${origin}/api/webhook/clerk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': valid ? `v1,${signature}` : 'v1,invalid',
    },
    body,
  });
}

async function expectIntact() {
  expect(await prisma.member.findUnique({ where: { id: memberId } })).not.toBeNull();
  expect(await prisma.memberDepartment.count({ where: { memberId } })).toBe(1);
  expect(deleteBlob).not.toHaveBeenCalled();
}

async function expectDeleted() {
  expect(await prisma.member.findUnique({ where: { id: memberId } })).toBeNull();
  expect(await prisma.memberDepartment.count({ where: { memberId } })).toBe(0);
  expect(await prisma.congregation.count()).toBe(1);
  expect(await prisma.department.count()).toBe(1);
}

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { downloadDir: join(tmpdir(), 'church-manager-mongodb-binaries') },
    replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
  });
  process.env.DATABASE_URL = database.getUri('member_deletion_tests');
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-blob-token');
  await promisify(execFile)(process.execPath, [
    'node_modules/prisma/build/index.js',
    'db',
    'push',
    '--skip-generate',
  ]);
  prisma = (await import('../server/utils/prisma')).default;
  service = await import('../server/utils/member-deletion');
  permissions = await import('../server/utils/rbac');
  const numbers = await import('../server/utils/member-number');
  Object.entries(h3).forEach(([name, value]) => vi.stubGlobal(name, value));
  vi.stubGlobal('prisma', prisma);
  vi.stubGlobal('assertPermission', permissions.assertPermission);
  vi.stubGlobal('assertCongregationAccess', permissions.assertCongregationAccess);
  vi.stubGlobal('resolveUserPermissions', async () => permissionContext('staff'));
  vi.stubGlobal('nextMemberNumber', numbers.nextMemberNumber);

  const app = h3.createApp({ onError: () => {} });
  app.use(
    h3.defineEventHandler((event) => {
      const role = h3.getHeader(event, 'x-test-role');
      const userId = role ? permissionContext(role).clerkUserId : null;
      event.context.auth = () => ({
        isAuthenticated: Boolean(role),
        userId,
      });
      event.context.rbac = role ? permissionContext(role) : null;
    }),
  );
  app.use((await import('../server/middleware/clerk')).default);
  app.use((await import('../server/middleware/rbac')).default);
  // The test role determines the resolved permission context for protected routes.
  app.use(
    h3.defineEventHandler((event) => {
      const role = h3.getHeader(event, 'x-test-role');
      event.context.rbac = role ? permissionContext(role) : null;
    }),
  );
  const router = h3.createRouter();
  router.delete('/api/members/:id', (await import('../server/api/members/[id].delete')).default);
  router.post('/api/webhook/clerk', (await import('../server/api/webhook/clerk.post')).default);
  app.use(router);
  server = createServer(h3.toNodeListener(app));
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  vi.clearAllMocks();
  deleteUser.mockReset().mockResolvedValue({ id: 'user_linked', deleted: true });
  deleteBlob.mockReset().mockResolvedValue(undefined);
  await prisma.memberDepartment.deleteMany();
  await prisma.member.deleteMany();
  await prisma.department.deleteMany();
  await prisma.congregation.deleteMany();
  congregationId = (await prisma.congregation.create({ data: { name: 'Test congregation' } })).id;
  departmentId = (await prisma.department.create({ data: { name: 'Test department' } })).id;
  memberId = (
    await prisma.member.create({
      data: {
        memberNumber: 1,
        name: 'Linked member',
        congregationId,
        clerkUserId: 'user_linked',
        photoBlobPath: 'members/photos/test.png',
      },
    })
  ).id;
  await prisma.memberDepartment.create({ data: { memberId, departmentId } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  if (prisma) await prisma.$disconnect();
  if (database) await database.stop();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('member deletion and Clerk synchronization', () => {
  it('deletes Clerk before local cleanup and makes repeated requests safe', async () => {
    deleteUser.mockImplementationOnce(async () => {
      await expectIntact();
    });
    expect((await remove()).status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith('user_linked');
    await expectDeleted();
    expect(deleteBlob).toHaveBeenCalledWith('members/photos/test.png', {
      token: 'test-blob-token',
    });
    expect(await (await remove()).json()).toEqual({ success: true });
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it('does not contact Clerk for unlinked members', async () => {
    await prisma.member.update({ where: { id: memberId }, data: { clerkUserId: null } });
    expect((await remove()).status).toBe(200);
    expect(deleteUser).not.toHaveBeenCalled();
    await expectDeleted();
  });

  it.each([
    ['unauthenticated', '', 401],
    ['without delete permission', 'reader', 403],
    ['outside congregation', 'outside', 403],
    ['own profile', 'self', 403],
  ])('rejects %s before contacting Clerk', async (_label, role, status) => {
    expect((await remove(role)).status).toBe(status);
    expect(deleteUser).not.toHaveBeenCalled();
    await expectIntact();
  });

  it.each([
    ['timeout', new Error('timeout')],
    ['unauthorized', clerkError(401, 'authentication_invalid')],
    ['rate limit', clerkError(429, 'too_many_requests')],
    ['unconfirmed not found', clerkError(404, 'other')],
    ['empty error', undefined],
  ])('keeps local data when Clerk returns %s', async (_label, error) => {
    deleteUser.mockRejectedValueOnce(error);
    expect((await remove()).status).toBe(502);
    await expectIntact();
    expect((await remove()).status).toBe(200);
    await expectDeleted();
  });

  it('completes cleanup when Clerk confirms the user is already gone', async () => {
    deleteUser.mockRejectedValueOnce(clerkError(404, 'resource_not_found'));
    expect((await remove()).status).toBe(200);
    await expectDeleted();
  });

  it('accepts signed dashboard deletion without a session and repeated deliveries', async () => {
    expect((await webhook()).status).toBe(200);
    await expectDeleted();
    expect((await webhook()).status).toBe(200);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(deleteBlob).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid signatures without changing local data', async () => {
    expect((await webhook(undefined, false)).status).toBe(400);
    await expectIntact();
  });

  it.each([
    { type: 'user.deleted' },
    { type: 'user.deleted', data: {} },
    { type: 'user.deleted', data: { id: '' } },
    { type: 'user.deleted', data: { id: 123 } },
  ])('rejects malformed signed deletion payload %j', async (payload) => {
    expect((await webhook(payload)).status).toBe(400);
    await expectIntact();
  });

  it('handles a deletion webhook arriving during the app deletion', async () => {
    deleteUser.mockImplementationOnce(async () => {
      expect((await webhook()).status).toBe(200);
    });
    expect((await remove()).status).toBe(200);
    await expectDeleted();
    expect(deleteBlob).toHaveBeenCalledTimes(1);
  });

  it('handles concurrent local cleanups', async () => {
    await Promise.all([
      service.deleteLocalMember({ id: memberId }),
      service.deleteLocalMember({ clerkUserId: 'user_linked' }),
    ]);
    await expectDeleted();
    expect(deleteBlob).toHaveBeenCalledTimes(1);
  });

  it('returns 500 for database failures and completes on webhook retry', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('Database unavailable'));
    expect((await webhook()).status).toBe(500);
    expect(log).toHaveBeenCalled();
    await expectIntact();
    expect((await webhook()).status).toBe(200);
    await expectDeleted();
  });

  it('rolls back department cleanup if deleting the member fails', async () => {
    const transaction = prisma.$transaction.bind(prisma) as <T>(
      operation: (tx: Prisma.TransactionClient) => Promise<T>,
    ) => Promise<T>;
    const failure = new Error('Member deletion failed');
    const failMemberDeletion = async (
      operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) =>
      transaction(async (tx) => {
        const member = new Proxy(tx.member, {
          get(target, key, receiver) {
            if (key === 'delete') return () => Promise.reject(failure);
            return Reflect.get(target, key, receiver);
          },
        });
        return operation(
          new Proxy(tx, {
            get(target, key, receiver) {
              if (key === 'member') return member;
              return Reflect.get(target, key, receiver);
            },
          }),
        );
      });
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(failMemberDeletion);
    await expect(service.deleteLocalMember({ id: memberId })).rejects.toBe(failure);
    await expectIntact();
  });

  it('finishes through a webhook when Clerk succeeds but app cleanup fails', async () => {
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('Database unavailable'));
    expect((await remove()).status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith('user_linked');
    await expectIntact();
    expect((await webhook()).status).toBe(200);
    await expectDeleted();
  });

  it('retries transaction conflicts and stops after five attempts', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('Write conflict', {
      code: 'P2034',
      clientVersion: Prisma.prismaVersion.client,
    });
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValue(conflict);
    await expect(service.deleteLocalMember({ id: memberId })).rejects.toBe(conflict);
    expect(transaction).toHaveBeenCalledTimes(5);
    await expectIntact();
    transaction.mockRestore();
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(conflict);
    await service.deleteLocalMember({ id: memberId });
    await expectDeleted();
  });

  it('does not fail a successful deletion if photo removal fails', async () => {
    deleteBlob.mockRejectedValueOnce(new Error('Blob unavailable'));
    expect((await remove()).status).toBe(200);
    await expectDeleted();
  });

  it('preserves existing user.created and user.updated behavior', async () => {
    expect(
      (await webhook({ type: 'user.updated', data: { id: 'user_linked', first_name: 'Updated' } }))
        .status,
    ).toBe(200);
    expect((await prisma.member.findUnique({ where: { id: memberId } }))?.name).toBe('Updated');
    expect(
      (await webhook({ type: 'user.created', data: { id: 'user_new', first_name: 'New' } })).status,
    ).toBe(200);
    expect(await prisma.member.findUnique({ where: { clerkUserId: 'user_new' } })).toMatchObject({
      name: 'New',
    });
  });
});
