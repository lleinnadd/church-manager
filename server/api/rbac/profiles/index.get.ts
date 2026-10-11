import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertAdmin(rbac);

  return prisma.rbacProfile.findMany({
    include: {
      _count: { select: { permissions: true, bindings: true } },
    },
    orderBy: { name: 'asc' },
  });
});
