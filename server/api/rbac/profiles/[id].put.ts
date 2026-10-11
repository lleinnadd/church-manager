import type { UserPermissionContext } from '~~/shared/types/rbac';
import { rbacProfileSchema } from '~~/shared/validation/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertAdmin(rbac);

  const id = getRouterParam(event, 'id');

  const existing = await prisma.rbacProfile.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  const parsed = rbacProfileSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const { name, description, permissions } = parsed.data;

  await prisma.rbacPermission.deleteMany({ where: { profileId: id } });

  const profile = await prisma.rbacProfile.update({
    where: { id },
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
