import { PermissionAction } from '@prisma/client';
import { treasuryConfigSchema } from '~~/shared/validation/transaction';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury-config', PermissionAction.UPDATE);

  const parsed = treasuryConfigSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const { initialBalance, initialBalanceDate, congregationId } = parsed.data;

  const congregation = await prisma.congregation.findUnique({
    where: { id: congregationId },
  });
  if (!congregation) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid congregationId' });
  }

  const where: Record<string, unknown> = {
    congregationId,
  };

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
      congregationId,
    },
  });

  return created;
});
