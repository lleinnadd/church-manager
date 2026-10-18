import { MemberStatus, Prisma } from '@prisma/client';
import { createError } from 'h3';
import type { UserPermissionContext } from '../../shared/types/rbac';
import type {
  ImportCandidate,
  ImportBatchView,
  ImportItemView,
} from '../../shared/types/member-import';
import {
  comparableImportValue,
  importDraftSchema,
  importFieldError,
  importFields,
  normalizeMemberName,
  type ImportDraft,
  type ImportExtraction,
  type ImportField,
  type ImportValues,
} from '../../shared/validation/member-import';
import { digitsOnly, isValidCpf } from '../../shared/validation/member';
import prisma from './prisma';
import {
  assertImportCongregation,
  assertImportContext,
  canImportCongregation,
  getImportBatch,
} from './member-import-access';

type Database = typeof prisma | Prisma.TransactionClient;
const memberSelect = {
  id: true,
  memberNumber: true,
  updatedAt: true,
  clerkUserId: true,
  name: true,
  congregationId: true,
  status: true,
  dateOfBirth: true,
  ssn: true,
  nationalId: true,
  maritalStatus: true,
  addressLinePrimary: true,
  district: true,
  memberSince: true,
  baptismDate: true,
  motherName: true,
  fatherName: true,
  naturality: true,
  nationality: true,
  convertionDate: true,
  phonePrimary: true,
  phoneSecondary: true,
  observations: true,
} as const;
type MatchMember = Prisma.MemberGetPayload<{ select: typeof memberSelect }>;
const conflict = (code: string) =>
  createError({ statusCode: 409, statusMessage: 'Import needs review', data: { code } });
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function candidate(
  member: MatchMember,
  values: ImportValues,
  reason: ImportCandidate['reason'],
): ImportCandidate {
  const cpf = values.ssn && isValidCpf(values.ssn) ? digitsOnly(values.ssn) : '';
  const cpfMatch = Boolean(cpf && cpf === digitsOnly(member.ssn || ''));
  const birth = comparableImportValue('dateOfBirth', values.dateOfBirth);
  const birthMatch = Boolean(
    birth && birth === comparableImportValue('dateOfBirth', member.dateOfBirth),
  );
  const contradiction = Boolean(
    (cpf && member.ssn && !cpfMatch) || (birth && member.dateOfBirth && !birthMatch),
  );
  return {
    id: member.id,
    name: member.name,
    memberNumber: member.memberNumber,
    updatedAt: member.updatedAt.toISOString(),
    clerkUserId: member.clerkUserId,
    values: Object.fromEntries(
      importFields.map((field) => [field, comparableImportValue(field, member[field])]),
    ),
    reason,
    supported: cpfMatch || (reason === 'name' && birthMatch),
    contradiction,
  };
}
export async function findImportMatches(
  ctx: UserPermissionContext,
  values: ImportValues,
  db: Database = prisma,
  search = '',
  memberId?: string | null,
) {
  // v1 follows the existing small-directory design. Keep normalization identical
  // for existing members without requiring a member backfill.
  const members = await db.member.findMany({ select: memberSelect });
  const name = normalizeMemberName(values.name || '');
  const query = normalizeMemberName(search);
  const cpf = values.ssn && isValidCpf(values.ssn) ? digitsOnly(values.ssn) : '';
  const candidates: ImportCandidate[] = [];
  let blocked = false;
  members.forEach((member) => {
    const nameMatch = Boolean(name && normalizeMemberName(member.name) === name);
    const cpfMatch = Boolean(cpf && digitsOnly(member.ssn || '') === cpf);
    const manual = Boolean(
      member.id === memberId || (query && normalizeMemberName(member.name).includes(query)),
    );
    if (!nameMatch && !cpfMatch && !manual) return;
    let reason: ImportCandidate['reason'] = 'manual';
    if (nameMatch) reason = 'name';
    else if (cpfMatch) reason = 'cpf';
    const entry = candidate(member, values, reason);
    if (!canImportCongregation(ctx, member.congregationId)) {
      if ((nameMatch || cpfMatch) && entry.supported) blocked = true;
      return;
    }
    candidates.push(entry);
  });
  candidates.sort(
    (a, b) =>
      Number(b.reason === 'name') - Number(a.reason === 'name') ||
      Number(b.supported) - Number(a.supported) ||
      a.name.localeCompare(b.name),
  );
  return { candidates: candidates.slice(0, 50), blocked };
}

export function initialImportDraft(
  extraction: ImportExtraction,
  congregationId: string,
): ImportDraft {
  return {
    values: { ...extraction.values, congregationId },
    target: null,
    memberId: null,
    memberUpdatedAt: null,
    decisions: {},
    confirmedWarnings: [],
    approved: false,
  };
}

export async function readImportBatch(
  ctx: UserPermissionContext,
  batchId: string,
): Promise<ImportBatchView> {
  const batch = await getImportBatch(ctx, batchId);
  const items = await prisma.memberImportItem.findMany({
    where: { batchId },
    orderBy: { createdAt: 'asc' },
  });
  const views = await items.reduce<Promise<ImportItemView[]>>(async (previous, item) => {
    const entries = await previous;
    const extraction = item.extraction as unknown as ImportExtraction | null;
    let draft = item.draft as unknown as ImportDraft | null;
    const matches =
      draft && item.status === 'REVIEW_READY'
        ? await findImportMatches(ctx, draft.values, prisma, '', draft.memberId)
        : { candidates: [], blocked: false };
    if (draft && !draft.target) {
      const supported = matches.candidates.filter(
        (entry) => entry.supported && !entry.contradiction,
      );
      if (!matches.blocked && supported.length === 1) {
        const selected = supported[0]!;
        draft = {
          ...draft,
          target: 'existing',
          memberId: selected.id,
          memberUpdatedAt: selected.updatedAt,
        };
      }
    }
    entries.push({
      id: item.id,
      fileName: item.fileName,
      status: item.status,
      revision: item.revision,
      extraction,
      draft,
      errorCode: item.errorCode,
      savedMemberId: item.savedMemberId,
      result: item.result,
      ...matches,
      sourceUrl: `/api/member-imports/${batchId}/items/${item.id}/source`,
    });
    return entries;
  }, Promise.resolve([]));
  return {
    id: batch.id,
    createdAt: batch.createdAt.toISOString(),
    congregationId: batch.congregationId,
    items: views,
  };
}

export function importChanges(
  draft: ImportDraft,
  extraction: ImportExtraction,
  existing: Partial<Record<ImportField, unknown>> | null,
  nameLocked = false,
) {
  const errors: Partial<Record<ImportField, string>> = {};
  const changes: Record<string, string | Date> = {};
  importFields.forEach((field) => {
    const value = draft.values[field]?.trim() || '';
    const previous = comparableImportValue(field, existing?.[field]);
    const decision = draft.decisions[field];
    if (decision === 'omit' || decision === 'keep' || !value || (nameLocked && field === 'name'))
      return;
    if (previous && previous !== comparableImportValue(field, value) && decision !== 'use') {
      errors[field] = 'UNRESOLVED_CONFLICT';
      return;
    }
    if (extraction.warnings[field] && !draft.confirmedWarnings.includes(field)) {
      errors[field] = extraction.warnings[field]!;
      return;
    }
    const invalid = importFieldError(field, value);
    if (invalid) {
      errors[field] = invalid;
      return;
    }
    if (previous === comparableImportValue(field, value)) return;
    changes[field] = ['dateOfBirth', 'memberSince', 'baptismDate', 'convertionDate'].includes(field)
      ? new Date(`${value}T00:00:00.000Z`)
      : comparableImportValue(field, value);
  });
  if (!existing) {
    if (!changes.name) errors.name = 'REQUIRED';
    if (!changes.congregationId) errors.congregationId = 'REQUIRED';
    if (!changes.status) changes.status = MemberStatus.ACTIVE;
  }
  if (Object.keys(errors).length)
    throw createError({
      statusCode: 400,
      statusMessage: 'Resolve fields before approval',
      data: { code: 'INVALID_FIELDS', fields: errors },
    });
  return changes;
}

export async function saveImportDraft(
  ctx: UserPermissionContext,
  batchId: string,
  itemId: string,
  revision: number,
  rawDraft: unknown,
) {
  assertImportContext(ctx);
  await getImportBatch(ctx, batchId);
  const draft = importDraftSchema.parse(rawDraft) as ImportDraft;
  return prisma.$transaction(async (tx) => {
    const touched = await tx.memberImportBatch.updateMany({
      where: { id: batchId, deleting: false },
      data: { revision: { increment: 1 } },
    });
    if (!touched.count) throw conflict('BATCH_CHANGED');
    if (draft.approved) {
      const item = await tx.memberImportItem.findFirst({
        where: { id: itemId, batchId, revision, status: 'REVIEW_READY' },
      });
      if (!item?.extraction) throw conflict('DRAFT_CHANGED');
      if (!draft.target) throw conflict('APPROVAL_REQUIRED');
      const matches = await findImportMatches(ctx, draft.values, tx, '', draft.memberId);
      if (matches.blocked) throw conflict('MATCH_UNAVAILABLE');
      const existing =
        draft.target === 'existing' && draft.memberId
          ? await tx.member.findUnique({ where: { id: draft.memberId }, select: memberSelect })
          : null;
      if (
        draft.target === 'existing' &&
        (!existing || existing.updatedAt.toISOString() !== draft.memberUpdatedAt)
      )
        throw conflict('MEMBER_CHANGED');
      if (draft.target === 'new' && (draft.memberId || draft.memberUpdatedAt))
        throw conflict('INVALID_TARGET');
      if (draft.target === 'new' && matches.candidates.some((entry) => entry.supported))
        throw conflict('MATCH_CHANGED');
      if (existing) assertImportCongregation(ctx, existing.congregationId);
      const changes = importChanges(
        draft,
        item.extraction as unknown as ImportExtraction,
        existing,
        Boolean(existing?.clerkUserId),
      );
      assertImportCongregation(
        ctx,
        String(changes.congregationId || existing?.congregationId || ''),
      );
      if (existing?.clerkUserId && changes.status && changes.status !== MemberStatus.ACTIVE)
        throw conflict('ACCOUNT_MANAGED_STATUS');
    }
    const result = await tx.memberImportItem.updateMany({
      where: { id: itemId, batchId, revision, status: 'REVIEW_READY' },
      data: { draft: json(draft), revision: { increment: 1 } },
    });
    if (!result.count) throw conflict('DRAFT_CHANGED');
    return { revision: revision + 1 };
  });
}

export async function commitImportItem(
  ctx: UserPermissionContext,
  batchId: string,
  itemId: string,
  revision: number,
) {
  assertImportContext(ctx);
  await getImportBatch(ctx, batchId);
  await prisma.memberImportLock.upsert({
    where: { id: 'commits' },
    create: { id: 'commits' },
    update: {},
  });
  const commit = async (
    attempt: number,
  ): Promise<{ memberId: string | null | undefined; result: string | null }> => {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.memberImportLock.update({
            where: { id: 'commits' },
            data: { revision: { increment: 1 } },
          });
          const batch = await tx.memberImportBatch.findUnique({ where: { id: batchId } });
          if (!batch || batch.deleting) throw conflict('BATCH_CHANGED');
          const item = await tx.memberImportItem.findFirst({ where: { id: itemId, batchId } });
          if (!item) throw createError({ statusCode: 404, statusMessage: 'Import unavailable' });
          if (item.status === 'IMPORTED')
            return { memberId: item.savedMemberId, result: item.result };
          if (item.status !== 'REVIEW_READY' || item.revision !== revision || !item.extraction)
            throw conflict('DRAFT_CHANGED');
          const draft = importDraftSchema.parse(item.draft) as ImportDraft;
          if (!draft.approved || !draft.target) throw conflict('APPROVAL_REQUIRED');
          const matches = await findImportMatches(ctx, draft.values, tx, '', draft.memberId);
          if (matches.blocked) throw conflict('MATCH_UNAVAILABLE');
          const existing =
            draft.target === 'existing' && draft.memberId
              ? await tx.member.findUnique({ where: { id: draft.memberId }, select: memberSelect })
              : null;
          if (
            draft.target === 'existing' &&
            (!existing || existing.updatedAt.toISOString() !== draft.memberUpdatedAt)
          )
            throw conflict('MEMBER_CHANGED');
          if (draft.target === 'new' && matches.candidates.some((entry) => entry.supported))
            throw conflict('MATCH_CHANGED');
          if (draft.target === 'new' && (draft.memberId || draft.memberUpdatedAt))
            throw conflict('INVALID_TARGET');
          if (existing) assertImportCongregation(ctx, existing.congregationId);
          const changes = importChanges(
            draft,
            item.extraction as unknown as ImportExtraction,
            existing,
            Boolean(existing?.clerkUserId),
          );
          const congregationId = String(changes.congregationId || existing?.congregationId || '');
          assertImportCongregation(ctx, congregationId);
          if (
            !(await tx.congregation.findUnique({
              where: { id: congregationId },
              select: { id: true },
            }))
          )
            throw conflict('CONGREGATION_CHANGED');
          if (existing?.clerkUserId && changes.status && changes.status !== MemberStatus.ACTIVE)
            throw conflict('ACCOUNT_MANAGED_STATUS');
          let result = 'created';
          if (existing) result = Object.keys(changes).length ? 'updated' : 'unchanged';
          let memberId = existing?.id;
          if (existing && Object.keys(changes).length) {
            const updated = await tx.member.updateMany({
              where: { id: existing.id, updatedAt: existing.updatedAt },
              data: changes,
            });
            if (!updated.count) throw conflict('MEMBER_CHANGED');
          } else if (!existing) {
            const last = await tx.member.findFirst({
              orderBy: { memberNumber: 'desc' },
              select: { memberNumber: true },
            });
            const member = await tx.member.create({
              data: {
                ...changes,
                memberNumber: (last?.memberNumber || 0) + 1,
                name: String(changes.name),
                congregationId,
              },
            });
            memberId = member.id;
          }
          await tx.memberImportBatch.update({
            where: { id: batchId },
            data: { revision: { increment: 1 } },
          });
          await tx.memberImportItem.update({
            where: { id: itemId },
            data: {
              status: 'IMPORTED',
              savedMemberId: memberId,
              result,
              errorCode: null,
              revision: { increment: 1 },
            },
          });
          return { memberId, result };
        },
        { timeout: 15000 },
      );
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code);
      if (!retryable || attempt === 4) throw error;
      return commit(attempt + 1);
    }
  };
  return commit(0);
}
