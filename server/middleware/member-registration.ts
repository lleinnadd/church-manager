import {
  isPublicMemberRegistrationApi,
  isPublicMemberRegistrationPage,
} from '../../shared/utils/member-registration';

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (isPublicMemberRegistrationPage(path) || isPublicMemberRegistrationApi(path, event.method)) {
    setResponseHeader(event, 'Cache-Control', 'no-store');
    setResponseHeader(event, 'Referrer-Policy', 'no-referrer');
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
  }
});
