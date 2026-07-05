export default defineNuxtRouteMiddleware(async (to) => {
  const { requiredPermission } = to.meta;

  if (!requiredPermission) return undefined;

  const { can, permissions, refresh } = usePermissions();

  if (!permissions.value) {
    await refresh();
  }

  if (!can(requiredPermission.resource, requiredPermission.action)) {
    return navigateTo('/no-access');
  }

  return undefined;
});
