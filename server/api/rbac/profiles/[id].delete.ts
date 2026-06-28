import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'rbac', PermissionAction.MANAGE);

  const id = getRouterParam(event, 'id');

  const profile = await prisma.rbacProfile.findUnique({ where: { id } });
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  if (profile.isSystem) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete system profiles' });
  }

  await prisma.rbacPermission.deleteMany({ where: { profileId: id } });
  await prisma.rbacProfileBinding.deleteMany({ where: { profileId: id } });
  await prisma.rbacProfile.delete({ where: { id } });

  return { success: true };
});
