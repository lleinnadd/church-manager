import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'rbac', PermissionAction.MANAGE);

  return prisma.rbacProfile.findMany({
    include: {
      _count: { select: { permissions: true, bindings: true } },
    },
    orderBy: { name: 'asc' },
  });
});
