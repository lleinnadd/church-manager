import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'congregations', PermissionAction.READ);

  const id = getRouterParam(event, 'id');

  const congregation = await prisma.congregation.findUnique({
    where: { id },
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  if (!congregation) {
    throw createError({ statusCode: 404, statusMessage: 'Congregation not found' });
  }

  assertCongregationAccess(rbac, 'congregations', congregation.id);

  const leadership = await getCongregationLeadership(prisma, congregation.id);

  return {
    ...congregation,
    leadership,
  };
});
