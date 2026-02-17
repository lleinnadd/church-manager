export default defineNuxtRouteMiddleware(async (to) => {
  const { userId } = useAuth();
  const { user } = useUser();

  const isAuthRoute = to.path.startsWith('/auth');

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
  }

  return undefined;
});
