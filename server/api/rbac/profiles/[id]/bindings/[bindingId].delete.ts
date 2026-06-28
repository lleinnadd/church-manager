import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'rbac', PermissionAction.MANAGE);

  const bindingId = getRouterParam(event, 'bindingId');

  const binding = await prisma.rbacProfileBinding.findUnique({ where: { id: bindingId } });
  if (!binding) {
    throw createError({ statusCode: 404, statusMessage: 'Binding not found' });
  }

  await prisma.rbacProfileBinding.delete({ where: { id: bindingId } });

  return { success: true };
});
