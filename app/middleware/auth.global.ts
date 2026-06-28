export default defineNuxtRouteMiddleware(async (to) => {
  const { userId } = useAuth();
  const { user } = useUser();

  const isAuthRoute = to.path.startsWith('/auth');
  const isNoAccessRoute = to.path === '/no-access';

  if (!userId.value && !isAuthRoute) {
    return navigateTo('/auth/sign-in');
  }

  if (userId.value && isAuthRoute) {
    return navigateTo('/');
  }

  if (import.meta.client && userId.value && !isAuthRoute) {
    await $fetch('/api/members/ensure', {
      method: 'POST',
      body: {
        clerkUserId: userId.value,
        name: user.value?.fullName,
      },
    });

    if (!isNoAccessRoute) {
      const { hasAnyPermission, pending } = usePermissions();

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

      if (!hasAnyPermission.value) {
        return navigateTo('/no-access');
      }
    }
  }

  return undefined;
});
