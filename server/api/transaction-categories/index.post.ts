import { PermissionAction } from '@prisma/client';
import { transactionCategorySchema } from '~~/shared/validation/transaction';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury', PermissionAction.CREATE);

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
