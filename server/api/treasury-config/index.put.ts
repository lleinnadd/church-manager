import { treasuryConfigSchema } from '~~/shared/validation/transaction';

export default defineEventHandler(async (event) => {
  const parsed = treasuryConfigSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const { initialBalance, initialBalanceDate, congregationId } = parsed.data;

  const where: Record<string, unknown> = {};
  if (congregationId) {
    where.congregationId = congregationId;

    const congregation = await prisma.congregation.findUnique({
      where: { id: congregationId },
    });
    if (!congregation) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid congregationId' });
    }
  } else {
    where.congregationId = null;
  }

  const existing = await prisma.treasuryConfig.findFirst({ where });

  if (existing) {
    const updated = await prisma.treasuryConfig.update({
      where: { id: existing.id },
      data: {
        initialBalance,
        initialBalanceDate: new Date(initialBalanceDate),
      },
    });
    return updated;
  }

  const created = await prisma.treasuryConfig.create({
    data: {
      initialBalance,
      initialBalanceDate: new Date(initialBalanceDate),
      congregationId: congregationId ?? null,
    },
  });

  return created;
});
