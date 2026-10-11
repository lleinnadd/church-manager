import { createServer, type Server } from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as h3 from 'h3';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionAction, PermissionScopeType } from '@prisma/client';
import type { UserPermissionContext } from '../shared/types/rbac';
import { personalDetails, validPhoto } from './fixtures/member-registration';

vi.mock('@clerk/nuxt/server', () => ({
  clerkMiddleware: (handler: h3.EventHandler) => handler,
  createRouteMatcher:
    ([pattern]: string[]) =>
    (event: h3.H3Event) =>
      h3
        .getRequestURL(event)
        .pathname.startsWith(pattern?.includes('webhook') ? '/api/webhook' : '/api/'),
}));

vi.mock('../server/utils/member-photo', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/utils/member-photo')>();
  return { ...original, uploadMemberPhoto: vi.fn(), safeDeleteBlob: vi.fn() };
});

const resolvePermissions = vi.fn();
let database: MongoMemoryReplSet;
let prisma: typeof import('../server/utils/prisma').default;
let service: typeof import('../server/utils/member-registration');
let photos: typeof import('../server/utils/member-photo');
let server: Server;
let origin: string;
let memberId: string;
let congregationId: string;

function permissionContext(role: string): UserPermissionContext {
  return {
    memberId,
    clerkUserId: 'test-staff',
    congregationId,
    isAdmin: false,
    isGlobal: false,
    hasAnyPermission: true,
    allowedCongregationIds: role === 'other-congregation' ? [] : [congregationId],
    permissions: [
      {
        resource: 'members',
        action: role === 'reader' ? PermissionAction.READ : PermissionAction.UPDATE,
        scopeType: PermissionScopeType.OWN_CONGREGATION,
      },
    ],
  };
}

async function issue(expiresAt?: string, role = 'editor') {
  return fetch(`${origin}/api/members/${memberId}/registration-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-role': role },
    body: JSON.stringify(expiresAt ? { expiresAt } : {}),
  });
}

async function issueToken() {
  const response = await issue();
  expect(response.status).toBe(200);
  const { path } = await response.json();
  return path.split('/').pop() as string;
}

async function submit(token: string, details: unknown = personalDetails, file?: Blob) {
  const body = new FormData();
  body.append('data', JSON.stringify(details));
  if (file) body.append('file', file, 'photo.png');
  return fetch(`${origin}/api/public/member-registration/${token}`, { method: 'POST', body });
}

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { downloadDir: join(tmpdir(), 'church-manager-mongodb-binaries') },
    replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
  });
  process.env.DATABASE_URL = database.getUri('registration_tests');
  await promisify(execFile)(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push']);
  prisma = (await import('../server/utils/prisma')).default;
  service = await import('../server/utils/member-registration');
  photos = await import('../server/utils/member-photo');
  const permissions = await import('../server/utils/rbac');
  const departments = await import('../server/utils/member-departments');
  Object.entries(h3).forEach(([name, value]) => vi.stubGlobal(name, value));
  Object.entries(service).forEach(([name, value]) => vi.stubGlobal(name, value));
  vi.stubGlobal('prisma', prisma);
  vi.stubGlobal('assertPermission', permissions.assertPermission);
  vi.stubGlobal('assertCongregationAccess', permissions.assertCongregationAccess);
  vi.stubGlobal('resolveUserPermissions', resolvePermissions);
  vi.stubGlobal('resolveMemberDepartmentsInput', departments.resolveMemberDepartmentsInput);
  vi.stubGlobal('safeDeleteBlob', photos.safeDeleteBlob);

  const app = h3.createApp({ onError: () => {} });
  app.use(
    h3.defineEventHandler((event) => {
      const role = h3.getHeader(event, 'x-test-role');
      event.context.auth = () => ({
        isAuthenticated: Boolean(role),
        userId: role ? 'test-staff' : null,
      });
      resolvePermissions.mockResolvedValue(role ? permissionContext(role) : null);
    }),
  );
  app.use((await import('../server/middleware/clerk')).default);
  app.use((await import('../server/middleware/rbac')).default);
  app.use((await import('../server/middleware/member-registration')).default);
  const router = h3.createRouter();
  router.put('/api/members/:id', (await import('../server/api/members/[id].put')).default);
  router.post(
    '/api/members/:id/registration-link',
    (await import('../server/api/members/[id]/registration-link.post')).default,
  );
  router.get(
    '/api/public/member-registration/:token',
    (await import('../server/api/public/member-registration/[token].get')).default,
  );
  router.post(
    '/api/public/member-registration/:token',
    (await import('../server/api/public/member-registration/[token].post')).default,
  );
  app.use(router);
  server = createServer(h3.toNodeListener(app));
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  await prisma.memberDepartment.deleteMany();
  await prisma.member.deleteMany();
  await prisma.congregation.deleteMany();
  await prisma.department.deleteMany();
  const congregation = await prisma.congregation.create({ data: { name: 'Test congregation' } });
  congregationId = congregation.id;
  const member = await prisma.member.create({
    data: {
      memberNumber: 1,
      congregationId,
      name: 'Original name',
      observations: 'Internal notes',
      photoUrl: 'https://example.com/existing.png',
      photoBlobPath: 'members/photos/existing.png',
    },
  });
  memberId = member.id;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(photos.uploadMemberPhoto).mockReset();
  vi.mocked(photos.safeDeleteBlob).mockReset();
});

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  if (prisma) await prisma.$disconnect();
  if (database) await database.stop();
  vi.unstubAllGlobals();
});

describe('public member registration with MongoDB', () => {
  it.skipIf(!existsSync('.output/server/index.mjs'))(
    'serves the built public form without login and preserves protected API authentication',
    async () => {
      const token = await issueToken();
      const portProbe = createServer();
      await new Promise<void>((resolve) => {
        portProbe.listen(0, '127.0.0.1', resolve);
      });
      const { port } = portProbe.address() as AddressInfo;
      await new Promise<void>((resolve) => {
        portProbe.close(() => resolve());
      });
      const child = spawn(process.execPath, ['.output/server/index.mjs'], {
        env: {
          ...process.env,
          HOST: '127.0.0.1',
          PORT: String(port),
          NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('clerk.example.com$').toString('base64')}`,
          NUXT_CLERK_SECRET_KEY: 'sk_test_registration_smoke_fixture',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Built app startup timed out')), 10000);
          child.stdout.on('data', (chunk) => {
            if (String(chunk).includes('Listening')) {
              clearTimeout(timeout);
              resolve();
            }
          });
          child.on('exit', (code) => {
            clearTimeout(timeout);
            reject(new Error(`Built app exited: ${code}`));
          });
        });
        const builtOrigin = `http://127.0.0.1:${port}`;
        const response = await fetch(`${builtOrigin}/complete-registration/${token}`, {
          redirect: 'manual',
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('cache-control')).toBe('no-store');
        const html = await response.text();
        expect(html).toContain('Complete seu cadastro');
        expect(html).toContain('Original name');
        expect(html).toContain('<form');
        expect(html).not.toContain('Internal notes');
        expect((await fetch(`${builtOrigin}/api/members`)).status).toBe(401);
        expect(
          (await fetch(`${builtOrigin}/api/public/member-registration/not-a-token`)).status,
        ).toBe(404);
      } finally {
        child.kill();
        if (child.exitCode === null)
          await new Promise<void>((resolve) => {
            child.once('exit', () => resolve());
          });
      }
    },
  );

  it('requires staff update permission and congregation access to issue links', async () => {
    expect(
      (await fetch(`${origin}/api/members/${memberId}/registration-link`, { method: 'POST' }))
        .status,
    ).toBe(401);
    expect((await issue(undefined, 'reader')).status).toBe(403);
    expect((await issue(undefined, 'other-congregation')).status).toBe(403);
    expect((await issue()).status).toBe(200);
  });

  it('preserves the active checkout partial staff updates, photos, and departments', async () => {
    const department = await prisma.department.create({ data: { name: 'Test department' } });
    await prisma.memberDepartment.create({ data: { memberId, departmentId: department.id } });
    await prisma.member.update({ where: { id: memberId }, data: { status: 'TRANSFERRED' } });
    const response = await fetch(`${origin}/api/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-test-role': 'editor' },
      body: JSON.stringify({ name: 'Staff update', congregationId }),
    });
    expect(response.status).toBe(200);
    const stored = await prisma.member.findUnique({
      where: { id: memberId },
      include: { departments: true },
    });
    expect(stored).toMatchObject({
      name: 'Staff update',
      status: 'TRANSFERRED',
      photoBlobPath: 'members/photos/existing.png',
    });
    expect(stored?.departments).toHaveLength(1);
    expect(photos.safeDeleteBlob).not.toHaveBeenCalled();
  });

  it('defaults to 48 hours, accepts a future expiry, and rejects a past expiry', async () => {
    const before = Date.now();
    const created = await (await issue()).json();
    expect(new Date(created.expiresAt).getTime() - before).toBeGreaterThanOrEqual(48 * 3600000);
    expect(new Date(created.expiresAt).getTime() - before).toBeLessThan(48 * 3600000 + 1000);
    const custom = new Date(Date.now() + 3600000).toISOString();
    expect((await (await issue(custom)).json()).expiresAt).toBe(custom);
    expect((await issue('2000-01-01T00:00:00Z')).status).toBe(400);
  });

  it('loads without login or consumption, excludes private fields, and sets privacy headers', async () => {
    const token = await issueToken();
    const response = await fetch(`${origin}/api/public/member-registration/${token}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const { member } = await response.json();
    expect(member.name).toBe('Original name');
    [
      'id',
      'clerkUserId',
      'congregationId',
      'status',
      'departments',
      'isAdmin',
      'observations',
      'photoBlobPath',
      'registrationTokenHash',
    ].forEach((field) => expect(member).not.toHaveProperty(field));
    const stored = await prisma.member.findUnique({ where: { id: memberId } });
    expect(stored).not.toHaveProperty('registrationTokenHash');
    await expect(service.getRegistrationMember(token)).resolves.toBeDefined();
  });

  it('replaces previous links and handles deleted members', async () => {
    const oldToken = await issueToken();
    const newToken = await issueToken();
    expect((await submit(oldToken)).status).toBe(404);
    expect((await fetch(`${origin}/api/public/member-registration/${newToken}`)).status).toBe(200);
    await prisma.member.delete({ where: { id: memberId } });
    expect((await submit(newToken)).status).toBe(404);
  });

  it('saves once, normalizes optional blanks, and preserves administrative fields and departments', async () => {
    const department = await prisma.department.create({ data: { name: 'Test department' } });
    await prisma.memberDepartment.create({ data: { memberId, departmentId: department.id } });
    const token = await issueToken();
    expect((await submit(token)).status).toBe(200);
    expect((await submit(token, { ...personalDetails, name: 'Repeated edit' })).status).toBe(410);
    const stored = await prisma.member.findUnique({
      where: { id: memberId },
      include: { departments: true },
    });
    expect(stored).toMatchObject({
      name: personalDetails.name,
      congregationId,
      status: 'ACTIVE',
      observations: 'Internal notes',
      fatherName: null,
      nationalId: null,
      memberSince: null,
      convertionDate: null,
      isAdmin: false,
    });
    expect(stored?.departments).toHaveLength(1);
    expect(
      (await (await fetch(`${origin}/api/public/member-registration/${token}`)).json()).data.code,
    ).toBe('LINK_USED');
  });

  it('permits exactly one of two simultaneous saves', async () => {
    const token = await issueToken();
    const results = await Promise.all([
      submit(token, { ...personalDetails, name: 'First writer' }),
      submit(token, { ...personalDetails, name: 'Second writer' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 410]);
    const stored = await prisma.member.findUnique({
      where: { id: memberId },
      select: { name: true, registrationUsedAt: true },
    });
    expect(['First writer', 'Second writer']).toContain(stored?.name);
    expect(stored?.registrationUsedAt).toBeInstanceOf(Date);
  });

  it('rejects expired links', async () => {
    const token = await issueToken();
    await prisma.member.update({
      where: { id: memberId },
      data: { registrationExpiresAt: new Date(0) },
    });
    const response = await submit(token);
    expect(response.status).toBe(410);
    expect((await response.json()).data.code).toBe('LINK_EXPIRED');
  });

  it('leaves the link usable after invalid or protected-field submissions', async () => {
    const token = await issueToken();
    expect((await submit(token, { ...personalDetails, ssn: 'invalid' })).status).toBe(400);
    expect((await submit(token, { ...personalDetails, isAdmin: true })).status).toBe(400);
    expect((await submit(token)).status).toBe(200);
  });

  it('keeps Clerk-managed names locked while allowing other changes', async () => {
    await prisma.member.update({
      where: { id: memberId },
      data: { clerkUserId: 'clerk-test-member' },
    });
    const token = await issueToken();
    const { member } = await (
      await fetch(`${origin}/api/public/member-registration/${token}`)
    ).json();
    expect(member.nameLocked).toBe(true);
    expect((await submit(token)).status).toBe(400);
    expect((await submit(token, { ...personalDetails, name: 'Original name' })).status).toBe(200);
  });

  it('requires a photo and leaves the link usable after invalid photo submissions', async () => {
    await prisma.member.update({
      where: { id: memberId },
      data: { photoUrl: null, photoBlobPath: null },
    });
    const token = await issueToken();
    expect((await submit(token)).status).toBe(400);
    expect(
      (await submit(token, personalDetails, new Blob(['invalid'], { type: 'image/png' }))).status,
    ).toBe(400);
    expect(photos.uploadMemberPhoto).not.toHaveBeenCalled();
    await expect(service.getRegistrationMember(token)).resolves.toBeDefined();
  });
  it('retries an upload failure and removes the previous photo only after saving', async () => {
    const token = await issueToken();
    const uploaded = {
      photoUrl: 'https://example.com/new.png',
      photoBlobPath: 'members/photos/new.png',
    };
    vi.mocked(photos.uploadMemberPhoto).mockRejectedValueOnce(new Error('Storage unavailable'));
    const file = new Blob([new Uint8Array(validPhoto)], { type: 'image/png' });
    expect((await submit(token, personalDetails, file)).status).toBe(500);
    expect(photos.safeDeleteBlob).not.toHaveBeenCalled();
    await expect(service.getRegistrationMember(token)).resolves.toBeDefined();
    vi.mocked(photos.uploadMemberPhoto).mockResolvedValueOnce(uploaded);
    expect((await submit(token, personalDetails, file)).status).toBe(200);
    expect(photos.safeDeleteBlob).toHaveBeenCalledExactlyOnceWith('members/photos/existing.png');
    expect(await prisma.member.findUnique({ where: { id: memberId } })).toMatchObject(uploaded);
  });

  it('cleans up a replacement photo when the link expires during upload', async () => {
    const token = await issueToken();
    vi.mocked(photos.uploadMemberPhoto).mockImplementationOnce(async () => {
      await prisma.member.update({
        where: { id: memberId },
        data: { registrationExpiresAt: new Date(0) },
      });
      return { photoUrl: 'https://example.com/new.png', photoBlobPath: 'members/photos/new.png' };
    });
    const response = await submit(
      token,
      personalDetails,
      new Blob([new Uint8Array(validPhoto)], { type: 'image/png' }),
    );
    expect(response.status).toBe(410);
    expect((await response.json()).data.code).toBe('LINK_EXPIRED');
    expect(photos.safeDeleteBlob).toHaveBeenCalledExactlyOnceWith('members/photos/new.png');
    const stored = await prisma.member.findUnique({
      where: { id: memberId },
      select: { name: true, registrationUsedAt: true, photoBlobPath: true },
    });
    expect(stored).toMatchObject({
      name: 'Original name',
      registrationUsedAt: null,
      photoBlobPath: 'members/photos/existing.png',
    });
  });

  it('returns a retryable conflict after a concurrent staff edit without consuming the link', async () => {
    const token = await issueToken();
    vi.mocked(photos.uploadMemberPhoto).mockImplementationOnce(async () => {
      await prisma.member.update({
        where: { id: memberId },
        data: { name: 'Staff edit', updatedAt: new Date(Date.now() + 1000) },
      });
      return { photoUrl: 'https://example.com/new.png', photoBlobPath: 'members/photos/new.png' };
    });
    const response = await submit(
      token,
      personalDetails,
      new Blob([new Uint8Array(validPhoto)], { type: 'image/png' }),
    );
    expect(response.status).toBe(409);
    expect(photos.safeDeleteBlob).toHaveBeenCalledExactlyOnceWith('members/photos/new.png');
    await expect(service.getRegistrationMember(token)).resolves.toMatchObject({
      name: 'Staff edit',
    });
    expect((await submit(token)).status).toBe(200);
  });

  it('retains an upload after an ambiguous database error and leaves a confirmed uncommitted link usable', async () => {
    const token = await issueToken();
    vi.mocked(photos.uploadMemberPhoto).mockResolvedValueOnce({
      photoUrl: 'https://example.com/new.png',
      photoBlobPath: 'members/photos/new.png',
    });
    vi.spyOn(prisma.member, 'updateMany').mockRejectedValueOnce(
      new Error('Database connection interrupted'),
    );
    const response = await submit(
      token,
      personalDetails,
      new Blob([new Uint8Array(validPhoto)], { type: 'image/png' }),
    );
    expect(response.status).toBe(500);
    expect(photos.safeDeleteBlob).not.toHaveBeenCalled();
    await expect(service.getRegistrationMember(token)).resolves.toBeDefined();
    expect((await submit(token)).status).toBe(200);
  });

  it('keeps the winning photo and cleans up the losing concurrent replacement', async () => {
    const token = await issueToken();
    let uploadCount = 0;
    let releaseUploads: () => void = () => {};
    const bothUploaded = new Promise<void>((resolve) => {
      releaseUploads = resolve;
    });
    vi.mocked(photos.uploadMemberPhoto).mockImplementation(async () => {
      uploadCount += 1;
      const number = uploadCount;
      if (number === 2) releaseUploads();
      await bothUploaded;
      return {
        photoUrl: `https://example.com/new-${number}.png`,
        photoBlobPath: `members/photos/new-${number}.png`,
      };
    });
    const results = await Promise.allSettled([
      service.saveMemberRegistration(
        token,
        { ...personalDetails, name: 'First writer' },
        { data: validPhoto, type: 'image/png' },
      ),
      service.saveMemberRegistration(
        token,
        { ...personalDetails, name: 'Second writer' },
        { data: validPhoto, type: 'image/png' },
      ),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const stored = await prisma.member.findUnique({ where: { id: memberId } });
    const winningPath = stored?.photoBlobPath;
    const losingPath =
      winningPath === 'members/photos/new-1.png'
        ? 'members/photos/new-2.png'
        : 'members/photos/new-1.png';
    expect(photos.safeDeleteBlob).toHaveBeenCalledWith('members/photos/existing.png');
    expect(photos.safeDeleteBlob).toHaveBeenCalledWith(losingPath);
    expect(photos.safeDeleteBlob).not.toHaveBeenCalledWith(winningPath);
  });
});
