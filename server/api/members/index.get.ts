import prisma from '#server/utils/prisma';

export default defineEventHandler(async () => {
  return prisma.member.findMany({
    orderBy: { name: 'asc' },
    include: {
      congregation: {
        select: { id: true, name: true, type: true },
      },
      departments: {
        include: {
          department: true,
          congregation: {
            select: { id: true, name: true, type: true },
          },
          function: true,
        },
      },
    },
  });
});
