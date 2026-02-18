export default defineEventHandler(async () => {
  return prisma.member.findMany({
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
