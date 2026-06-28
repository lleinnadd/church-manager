export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  if (
    !path.startsWith('/api/') ||
    path.startsWith('/api/webhook') ||
    path === '/api/members/ensure' ||
    path === '/api/auth/permissions'
  ) {
    return;
  }

  const auth = (event.context.auth as () => { userId: string | null })();
  if (!auth?.userId) return;

  event.context.rbac = await resolveUserPermissions(auth.userId);
});
