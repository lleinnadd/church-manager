export default defineEventHandler(async () => {
  const congregations = await prisma.congregation.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  return congregations;
});
