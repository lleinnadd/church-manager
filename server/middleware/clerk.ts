import { clerkMiddleware, createRouteMatcher } from '@clerk/nuxt/server';
import { isPublicMemberRegistrationApi } from '../../shared/utils/member-registration';

const isProtectedRoute = createRouteMatcher(['/api/(.*)']);
const isWebhookRoute = createRouteMatcher(['/api/webhook(.*)']);

export default clerkMiddleware((event) => {
  if (isWebhookRoute(event)) return;
  if (isPublicMemberRegistrationApi(getRequestURL(event).pathname, event.method)) return;

  const authFn = event.context.auth as unknown;
  const authResult =
    typeof authFn === 'function'
      ? (authFn as () => { isAuthenticated: boolean })()
      : { isAuthenticated: false };

  if (!authResult.isAuthenticated && isProtectedRoute(event)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not signed in',
    });
  }
});
