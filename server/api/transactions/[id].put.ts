import { createTransactionSchema } from '~~/shared/validation/transaction';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Transaction id is required' });
  }

  const parsed = createTransactionSchema().safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const body = parsed.data;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Transaction not found' });
  }

  const congregation = await prisma.congregation.findUnique({
    where: { id: body.congregationId },
  });
  if (!congregation) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid congregationId' });
  }

  if (body.categoryId) {
    const category = await prisma.transactionCategory.findUnique({
      where: { id: body.categoryId },
    });
    if (!category) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid categoryId' });
    }
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      name: body.name,
      type: body.type,
      amount: body.amount,
      date: new Date(body.date),
      notes: body.notes ?? null,
      categoryId: body.categoryId ?? null,
      congregationId: body.congregationId,
    },
    include: {
      category: true,
      congregation: { select: { id: true, name: true, type: true } },
      attachments: true,
    },
  });

  return transaction;
});
