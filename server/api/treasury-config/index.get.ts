import { z } from 'zod';

const querySchema = z.object({
  congregationId: z.string(),
});

export default defineEventHandler(async (event) => {
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params' });
  }

  const where: Record<string, unknown> = {
    congregationId: parsed.data.congregationId,
  };

  const config = await prisma.treasuryConfig.findFirst({ where });

  return (
    config ?? {
      initialBalance: 0,
      initialBalanceDate: new Date().toISOString(),
      congregationId: parsed.data.congregationId,
    }
  );
});
