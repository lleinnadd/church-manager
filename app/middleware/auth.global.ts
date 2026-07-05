const ensured = ref(false);

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

  if (userId.value && !isAuthRoute) {
    // Ensure a member record exists for this Clerk user (client-only, once per session).
    if (import.meta.client && !ensured.value) {
      await $fetch('/api/members/ensure', {
        method: 'POST',
        body: {
          clerkUserId: userId.value,
          name: user.value?.fullName,
        },
      });
      ensured.value = true;
    }

    const { hasAnyPermission, permissions, refresh } = usePermissions();

    if (!permissions.value) {
      await refresh();
    }

    // No permissions at all → send to the no-access screen.
    if (!hasAnyPermission.value && !isNoAccessRoute) {
      return navigateTo('/no-access');
    }

    // Has access but landed on no-access → send back into the app.
    if (hasAnyPermission.value && isNoAccessRoute) {
      return navigateTo('/');
    }
  }

  return undefined;
});
