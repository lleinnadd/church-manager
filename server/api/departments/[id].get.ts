import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      functions: true,
      _count: { select: { memberships: true } },
    },
  });

  if (!department) {
    throw createError({ statusCode: 404, statusMessage: 'Department not found' });
  }

  return department;
});
