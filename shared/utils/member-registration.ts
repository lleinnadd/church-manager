export const isPublicMemberRegistrationPage = (path: string) =>
  /^\/complete-registration\/[^/]+\/?$/.test(path);

export const isPublicMemberRegistrationApi = (path: string, method: string) =>
  (method === 'GET' || method === 'POST') &&
  /^\/api\/public\/member-registration\/[^/]+\/?$/.test(path);
