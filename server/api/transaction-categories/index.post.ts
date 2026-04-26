import { transactionCategorySchema } from '~~/shared/validation/transaction';

export default defineEventHandler(async (event) => {
  const parsed = transactionCategorySchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const existing = await prisma.transactionCategory.findFirst({
    where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
  });

  if (existing) {
    return existing;
  }

  const category = await prisma.transactionCategory.create({
    data: { name: parsed.data.name },
  });

  return category;
});
