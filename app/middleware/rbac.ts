export default defineNuxtRouteMiddleware(async (to) => {
  const { requiredPermission, requireAdmin } = to.meta;

  if (!requiredPermission && !requireAdmin) return undefined;

  const { can, isAdmin, permissions, refresh } = usePermissions();

  if (!permissions.value) {
    await refresh();
  }

  if (requireAdmin && !isAdmin.value) {
    return navigateTo('/no-access');
  }

  if (requiredPermission && !can(requiredPermission.resource, requiredPermission.action)) {
    return navigateTo('/no-access');
  }

  return undefined;
});
