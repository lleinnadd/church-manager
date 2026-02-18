export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  const congregation = await prisma.congregation.findUnique({
    where: { id },
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  if (!congregation) {
    throw createError({ statusCode: 404, statusMessage: 'Congregation not found' });
  }

  return congregation;
});
