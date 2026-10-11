import { PermissionAction } from '@prisma/client';
import { z } from 'zod';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const querySchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  congregationId: z.string().optional(),
  categoryId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury', PermissionAction.READ);

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params' });
  }

  const { type, congregationId, categoryId, startDate, endDate } = parsed.data;

  if (congregationId) {
    assertCongregationAccess(rbac, 'treasury', congregationId);
  }
  const scopeFilter = congregationId ? { congregationId } : getCongregationFilter(rbac, 'treasury');

  const where: Record<string, unknown> = { ...scopeFilter };

  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.date = dateFilter;
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      category: true,
      congregation: { select: { id: true, name: true, type: true } },
      attachments: true,
    },
    orderBy: { date: 'desc' },
  });

  return transactions;
});
