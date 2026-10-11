import type { UserPermissionsResponse } from '~~/shared/types/rbac';

export default defineEventHandler(async (event): Promise<UserPermissionsResponse> => {
  const auth = (event.context.auth as () => { userId: string | null })();
  if (!auth?.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const ctx = await resolveUserPermissions(auth.userId);
  if (!ctx) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  }

  return {
    memberId: ctx.memberId,
    congregationId: ctx.congregationId,
    isAdmin: ctx.isAdmin,
    isGlobal: ctx.isGlobal,
    hasAnyPermission: ctx.hasAnyPermission,
    allowedCongregationIds: ctx.allowedCongregationIds,
    permissions: ctx.permissions.map((p) => ({
      resource: p.resource,
      action: p.action,
      scopeType: p.scopeType,
    })),
  };
});
