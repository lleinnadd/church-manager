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

  const { name, description, permissions, bindings } = parsed.data;

  const uniqueBindings = dedupeBindings(bindings ?? []);
  if (uniqueBindings.length) {
    const functionIds = [...new Set(uniqueBindings.map((b) => b.functionId))];
    const found = await prisma.departmentFunction.count({ where: { id: { in: functionIds } } });
    if (found !== functionIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'One or more functions not found' });
    }
  }

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
      bindings: uniqueBindings.length
        ? {
            create: uniqueBindings.map((b) => ({
              functionId: b.functionId,
              scope: b.scope,
            })),
          }
        : undefined,
    },
    include: {
      permissions: true,
      bindings: { include: { function: true } },
    },
  });

  return profile;
});
