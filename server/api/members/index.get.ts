import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'members', PermissionAction.READ);

  const congregationFilter = getCongregationFilter(rbac, 'members');

  return prisma.member.findMany({
    where: congregationFilter,
    orderBy: { name: 'asc' },
    include: {
      congregation: {
        select: { id: true, name: true, type: true },
      },
      departments: {
        include: {
          department: {
            include: {
              localNames: {
                include: { congregation: { select: { id: true, name: true, type: true } } },
                orderBy: { name: 'asc' },
              },
            },
          },
          congregation: {
            select: { id: true, name: true, type: true },
          },
          function: true,
        },
      },
    },
  });
});
