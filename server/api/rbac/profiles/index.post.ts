import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';
import { rbacProfileSchema } from '~~/shared/validation/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'rbac', PermissionAction.MANAGE);

  const parsed = rbacProfileSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const { name, description, permissions } = parsed.data;

  const profile = await prisma.rbacProfile.create({
    data: {
      name,
      description: description || null,
      permissions: {
        create: permissions.map((p) => ({
          resource: p.resource,
          action: p.action,
          scopeType: p.scopeType,
        })),
      },
    },
    include: {
      permissions: true,
      bindings: { include: { function: true } },
    },
  });

  return profile;
});
