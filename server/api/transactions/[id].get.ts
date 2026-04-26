export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Transaction id is required' });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      category: true,
      congregation: { select: { id: true, name: true, type: true } },
      attachments: true,
    },
  });

  if (!transaction) {
    throw createError({ statusCode: 404, statusMessage: 'Transaction not found' });
  }

  return transaction;
});
