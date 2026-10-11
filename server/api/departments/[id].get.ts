import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'departments', PermissionAction.READ);

  const id = getRouterParam(event, 'id');

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      functions: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      localNames: {
        include: { congregation: { select: { id: true, name: true, type: true } } },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!department) {
    throw createError({ statusCode: 404, statusMessage: 'Department not found' });
  }

  const uniqueMembers = await prisma.memberDepartment.groupBy({
    by: ['memberId'],
    where: { departmentId: department.id },
  });

  return {
    ...department,
    _count: { memberships: uniqueMembers.length },
  };
});
