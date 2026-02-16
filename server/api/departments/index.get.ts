import prisma from '#server/utils/prisma';

export default defineEventHandler(async () => {
  return prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: {
      functions: true,
      _count: {
        select: { memberships: true },
      },
    },
  });
});
