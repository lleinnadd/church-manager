import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'members', PermissionAction.READ);

  const id = getRouterParam(event, 'id');

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      congregation: { select: { id: true, name: true, type: true } },
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
          congregation: { select: { id: true, name: true, type: true } },
          function: true,
        },
      },
    },
  });

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  }

  assertCongregationAccess(rbac, member.congregationId);

  return member;
});
