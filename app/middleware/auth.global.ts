export default defineNuxtRouteMiddleware((to) => {
  const { userId } = useAuth();

  const isAuthRoute = to.path.startsWith('/auth');

  if (!userId.value && !isAuthRoute) {
    return navigateTo('/auth/sign-in');
  }

  if (userId.value && isAuthRoute) {
    return navigateTo('/');
  }

  return undefined;
});
