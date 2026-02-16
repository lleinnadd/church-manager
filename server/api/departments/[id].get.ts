import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      functions: true,
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
