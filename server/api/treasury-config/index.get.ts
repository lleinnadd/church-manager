import { PermissionAction } from '@prisma/client';
import { z } from 'zod';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const querySchema = z.object({
  congregationId: z.string(),
});

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury-config', PermissionAction.READ);

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params' });
  }

  assertCongregationAccess(rbac, 'treasury-config', parsed.data.congregationId);

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
