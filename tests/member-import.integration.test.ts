import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PermissionAction, PermissionScopeType, Prisma } from '@prisma/client';
import type { UserPermissionContext } from '../shared/types/rbac';
import type { ImportDraft, ImportExtraction } from '../shared/validation/member-import';

let database: MongoMemoryReplSet;
let prisma: typeof import('../server/utils/prisma').default;
let service: typeof import('../server/utils/member-import');
let worker: typeof import('../server/utils/member-import-worker');
let congregationId: string;
let otherCongregationId: string;
let batchId: string;
let ctx: UserPermissionContext;
const extraction: ImportExtraction = {
  raw: { name: 'Test Person Alpha' },
  values: { name: 'Test Person Alpha', dateOfBirth: '2000-01-02' },
  warnings: {},
  model: 'fixture',
  durationMs: 1,
};
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { downloadDir: join(tmpdir(), 'church-manager-mongodb-binaries') },
    replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
  });
  process.env.DATABASE_URL = database.getUri('member_import_tests');
  await promisify(execFile)(process.execPath, [
    'node_modules/prisma/build/index.js',
    'db',
    'push',
    '--skip-generate',
  ]);
  prisma = (await import('../server/utils/prisma')).default;
  service = await import('../server/utils/member-import');
  worker = await import('../server/utils/member-import-worker');
});
beforeEach(async () => {
  await prisma.memberImportItem.deleteMany();
  await prisma.memberImportBatch.deleteMany();
  await prisma.memberImportLock.deleteMany();
  await prisma.member.deleteMany();
  await prisma.congregation.deleteMany();
  congregationId = (await prisma.congregation.create({ data: { name: 'Test congregation' } })).id;
  otherCongregationId = (
    await prisma.congregation.create({ data: { name: 'Other test congregation' } })
  ).id;
  ctx = {
    memberId: 'staff',
    clerkUserId: 'test-staff',
    congregationId,
    isAdmin: false,
    isGlobal: false,
    hasAnyPermission: true,
    allowedCongregationIds: [congregationId],
    permissions: [PermissionAction.READ, PermissionAction.CREATE, PermissionAction.UPDATE].map(
      (action) => ({
        resource: 'members',
        action,
        scopeType: PermissionScopeType.OWN_CONGREGATION,
      }),
    ),
  };
  batchId = (
    await prisma.memberImportBatch.create({ data: { congregationId, createdBy: ctx.clerkUserId } })
  ).id;
});
afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (database) await database.stop();
});

async function addItem(
  review = service.initialImportDraft(extraction, congregationId),
  status = 'REVIEW_READY',
) {
  return prisma.memberImportItem.create({
    data: {
      batchId,
      fileName: 'synthetic.jpg',
      sourcePath: `${batchId}/a.jpg`,
      previewPath: `${batchId}/a-preview.jpg`,
      sourceType: 'image/jpeg',
      sourceHash: crypto.randomUUID(),
      status,
      extraction: json(extraction),
      draft: json(review),
    },
  });
}
async function approveNew() {
  const review: ImportDraft = {
    ...service.initialImportDraft(extraction, congregationId),
    target: 'new',
    approved: true,
  };
  const item = await addItem(review);
  await service.saveImportDraft(ctx, batchId, item.id, 0, review);
  return { item, review, revision: 1 };
}
async function existingMember(
  overrides: Prisma.MemberUncheckedCreateInput = { name: 'Test Person Alpha', memberNumber: 1 },
) {
  return prisma.member.create({
    data: { ...overrides, congregationId: overrides.congregationId || congregationId },
  });
}

describe('reviewed imports with MongoDB transactions', () => {
  it('creates a new member and replays the receipt without creating another', async () => {
    const { item, revision } = await approveNew();
    const first = await service.commitImportItem(ctx, batchId, item.id, revision);
    const second = await service.commitImportItem(ctx, batchId, item.id, revision);
    expect(second).toEqual(first);
    expect(first.result).toBe('created');
    expect(await prisma.member.count()).toBe(1);
    expect((await prisma.member.findFirst())?.dateOfBirth?.toISOString().slice(0, 10)).toBe(
      '2000-01-02',
    );
  });
  it('finds normalized name first and preselects only with supporting birth date', async () => {
    const member = await existingMember({
      name: '  Test Pérson  Alpha ',
      memberNumber: 1,
      dateOfBirth: new Date('2000-01-02'),
    });
    await addItem();
    const view = await service.readImportBatch(ctx, batchId);
    expect(view.items[0]?.draft?.memberId).toBe(member.id);
    const matches = await service.findImportMatches(ctx, { name: 'test person alpha' });
    expect(matches.candidates[0]?.supported).toBe(false);
  });
  it('does not preselect contradictory identities or duplicate names', async () => {
    await existingMember({
      name: 'Test Person Alpha',
      memberNumber: 1,
      dateOfBirth: new Date('2000-01-02'),
      ssn: '52998224725',
    });
    await existingMember({
      name: 'Test Person Alpha',
      memberNumber: 2,
      dateOfBirth: new Date('2000-01-02'),
    });
    await addItem();
    expect((await service.readImportBatch(ctx, batchId)).items[0]?.draft?.target).toBeNull();
    const matches = await service.findImportMatches(ctx, {
      name: 'Test Person Alpha',
      ssn: '11144477735',
      dateOfBirth: '2000-01-02',
    });
    expect(matches.candidates.find((entry) => entry.memberNumber === 1)?.contradiction).toBe(true);
  });
  it('supports CPF lookup when handwritten name differs', async () => {
    const member = await existingMember({
      name: 'Other spelling',
      memberNumber: 1,
      ssn: '529.982.247-25',
    });
    const matches = await service.findImportMatches(ctx, {
      name: 'Different spelling',
      ssn: '52998224725',
    });
    expect(matches.candidates[0]).toMatchObject({ id: member.id, reason: 'cpf', supported: true });
  });
  it('fills gaps while preserving member identity, photo, account and registration metadata', async () => {
    const member = await existingMember({
      name: 'Test Person Alpha',
      memberNumber: 8,
      clerkUserId: 'account',
      isAdmin: true,
      dateOfBirth: new Date('2000-01-02'),
      photoUrl: 'https://example.com/existing.png',
      photoBlobPath: 'existing.png',
      registrationTokenHash: 'existing-hash',
      observations: 'Existing notes',
    });
    const review = {
      ...service.initialImportDraft(extraction, congregationId),
      target: 'existing' as const,
      memberId: member.id,
      memberUpdatedAt: member.updatedAt.toISOString(),
      values: {
        ...extraction.values,
        name: 'Changed account name',
        congregationId,
        motherName: 'Test Parent',
        baptismDate: '2026-09-27',
        observations: '',
      },
      approved: true,
    };
    const item = await addItem(review);
    await service.saveImportDraft(ctx, batchId, item.id, 0, review);
    expect((await service.commitImportItem(ctx, batchId, item.id, 1)).result).toBe('updated');
    const saved = await prisma.member.findUnique({
      where: { id: member.id },
      omit: { registrationTokenHash: false },
    });
    expect(saved).toMatchObject({
      memberNumber: 8,
      name: member.name,
      clerkUserId: 'account',
      isAdmin: true,
      observations: 'Existing notes',
      photoBlobPath: 'existing.png',
      registrationTokenHash: 'existing-hash',
      motherName: 'Test Parent',
    });
    expect(saved?.baptismDate?.toISOString().slice(0, 10)).toBe('2026-09-27');
  });
  it('rejects approval of unresolved populated-field conflicts', async () => {
    const member = await existingMember({
      name: 'Test Person Alpha',
      memberNumber: 1,
      district: 'Original district',
    });
    const review = {
      ...service.initialImportDraft(extraction, congregationId),
      target: 'existing' as const,
      memberId: member.id,
      memberUpdatedAt: member.updatedAt.toISOString(),
      values: { ...extraction.values, district: 'New district' },
      approved: true,
    };
    const item = await addItem(review);
    await expect(service.saveImportDraft(ctx, batchId, item.id, 0, review)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect((await prisma.memberImportItem.findUnique({ where: { id: item.id } }))?.revision).toBe(
      0,
    );
    review.decisions.district = 'keep';
    await service.saveImportDraft(ctx, batchId, item.id, 0, review);
    await service.commitImportItem(ctx, batchId, item.id, 1);
    expect((await prisma.member.findUnique({ where: { id: member.id } }))?.district).toBe(
      'Original district',
    );
  });
  it('rejects stale drafts and member changes between approval and save', async () => {
    const member = await existingMember({
      name: 'Test Person Alpha',
      memberNumber: 1,
      dateOfBirth: new Date('2000-01-02'),
    });
    const review = {
      ...service.initialImportDraft(extraction, congregationId),
      target: 'existing' as const,
      memberId: member.id,
      memberUpdatedAt: member.updatedAt.toISOString(),
      approved: true,
    };
    const item = await addItem(review);
    await service.saveImportDraft(ctx, batchId, item.id, 0, review);
    await expect(service.saveImportDraft(ctx, batchId, item.id, 0, review)).rejects.toMatchObject({
      statusCode: 409,
    });
    await prisma.member.update({
      where: { id: member.id },
      data: { observations: 'Concurrent staff edit' },
    });
    await expect(service.commitImportItem(ctx, batchId, item.id, 1)).rejects.toMatchObject({
      data: { code: 'MEMBER_CHANGED' },
    });
    expect((await prisma.memberImportItem.findUnique({ where: { id: item.id } }))?.status).toBe(
      'REVIEW_READY',
    );
  });
  it('blocks matches outside congregation scope without leaking candidate data', async () => {
    await existingMember({
      name: 'Test Person Alpha',
      memberNumber: 1,
      congregationId: otherCongregationId,
      dateOfBirth: new Date('2000-01-02'),
    });
    const matches = await service.findImportMatches(ctx, extraction.values);
    expect(matches).toEqual({ candidates: [], blocked: true });
    const item = await addItem({
      ...service.initialImportDraft(extraction, congregationId),
      target: 'new',
      approved: true,
    });
    await expect(service.commitImportItem(ctx, batchId, item.id, 0)).rejects.toMatchObject({
      data: { code: 'MATCH_UNAVAILABLE' },
    });
  });
  it('checks ownership and required permissions', async () => {
    await expect(
      service.readImportBatch({ ...ctx, clerkUserId: 'other-staff' }, batchId),
    ).rejects.toMatchObject({ statusCode: 404 });
    const { item } = await approveNew();
    await expect(
      service.commitImportItem(
        { ...ctx, permissions: ctx.permissions.slice(0, 1) },
        batchId,
        item.id,
        1,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('serializes concurrent forms for the same new member', async () => {
    const first = await approveNew();
    const second = await approveNew();
    const results = await Promise.allSettled([
      service.commitImportItem(ctx, batchId, first.item.id, 1),
      service.commitImportItem(ctx, batchId, second.item.id, 1),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.member.count()).toBe(1);
  });
  it('does not save into a deleting batch', async () => {
    const { item } = await approveNew();
    await prisma.memberImportBatch.update({ where: { id: batchId }, data: { deleting: true } });
    await expect(service.commitImportItem(ctx, batchId, item.id, 1)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await prisma.member.count()).toBe(0);
  });
});

describe('persistent local extraction worker', () => {
  it('extracts into a draft without writing a member', async () => {
    const item = await addItem(undefined, 'UPLOADED');
    expect(await worker.processNextImport(async () => extraction)).toBe(true);
    expect((await prisma.memberImportItem.findUnique({ where: { id: item.id } }))?.status).toBe(
      'REVIEW_READY',
    );
    expect(await prisma.member.count()).toBe(0);
  });
  it('retains failures for retry without changing members', async () => {
    const item = await addItem(undefined, 'UPLOADED');
    await worker.processNextImport(async () => {
      throw new Error('Model unavailable');
    });
    expect((await prisma.memberImportItem.findUnique({ where: { id: item.id } }))?.status).toBe(
      'FAILED',
    );
    expect(await prisma.member.count()).toBe(0);
  });
  it('recovers expired claims after interruption', async () => {
    const item = await addItem(undefined, 'PROCESSING');
    await prisma.memberImportItem.update({
      where: { id: item.id },
      data: { leaseToken: 'old-worker', leaseExpiresAt: new Date(0) },
    });
    await worker.processNextImport(async () => extraction);
    expect((await prisma.memberImportItem.findUnique({ where: { id: item.id } }))?.status).toBe(
      'REVIEW_READY',
    );
  });
});
