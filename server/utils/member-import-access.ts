import { PermissionAction, PermissionScopeType } from '@prisma/client';
import { createError, type H3Event } from 'h3';
import type { UserPermissionContext } from '../../shared/types/rbac';
import { objectIdSchema } from '../../shared/validation/member-import';
import prisma from './prisma';
import { assertPermission } from './rbac';

export const importActions = [
  PermissionAction.READ,
  PermissionAction.CREATE,
  PermissionAction.UPDATE,
];
export function assertImportContext(
  ctx: UserPermissionContext | null | undefined,
): asserts ctx is UserPermissionContext {
  importActions.forEach((action) => assertPermission(ctx, 'members', action));
}
export function importContext(event: H3Event) {
  const ctx = event.context.rbac as UserPermissionContext | undefined;
  assertImportContext(ctx);
  return ctx;
}
export function canImportCongregation(ctx: UserPermissionContext, congregationId: string | null) {
  return importActions.every(
    (action) =>
      ctx.isAdmin ||
      ctx.permissions.some(
        (p) =>
          p.resource === 'members' &&
          (p.action === action || p.action === PermissionAction.MANAGE) &&
          (p.scopeType === PermissionScopeType.ALL ||
            Boolean(congregationId && ctx.allowedCongregationIds.includes(congregationId))),
      ),
  );
}
export function assertImportCongregation(
  ctx: UserPermissionContext,
  congregationId: string | null,
) {
  if (!canImportCongregation(ctx, congregationId))
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
}
export function importId(value: unknown) {
  const parsed = objectIdSchema.safeParse(value);
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid identifier' });
  return parsed.data;
}
export async function getImportBatch(
  ctx: UserPermissionContext,
  id: string,
  allowDeleting = false,
) {
  const batch = await prisma.memberImportBatch.findUnique({ where: { id: importId(id) } });
  if (!batch || (!ctx.isAdmin && batch.createdBy !== ctx.clerkUserId))
    throw createError({ statusCode: 404, statusMessage: 'Import unavailable' });
  assertImportCongregation(ctx, batch.congregationId);
  if (batch.deleting && !allowDeleting)
    throw createError({ statusCode: 409, statusMessage: 'Import is being deleted' });
  return batch;
}
