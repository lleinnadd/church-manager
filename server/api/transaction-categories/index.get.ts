import { PermissionAction } from '@prisma/client';
import { z } from 'zod';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const querySchema = z.object({
  q: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury', PermissionAction.READ);

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params' });
  }

  const where = parsed.data.q
    ? { name: { contains: parsed.data.q, mode: 'insensitive' as const } }
    : {};

  const categories = await prisma.transactionCategory.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 50,
  });

  return categories;
});
