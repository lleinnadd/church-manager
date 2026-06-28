export default defineNuxtRouteMiddleware(async (to) => {
  const { requiredPermission } = to.meta;

  if (!requiredPermission) return undefined;

  const { can, pending } = usePermissions();

  if (pending.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(pending, (val) => {
        if (!val) {
          stop();
          resolve();
        }
      });
    });
  }

  if (!can(requiredPermission.resource, requiredPermission.action)) {
    return navigateTo('/');
  }

  return undefined;
});
