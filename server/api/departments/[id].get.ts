import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
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
