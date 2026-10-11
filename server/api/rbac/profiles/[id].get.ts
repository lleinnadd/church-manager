import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertAdmin(rbac);

  const id = getRouterParam(event, 'id');

  const profile = await prisma.rbacProfile.findUnique({
    where: { id },
    include: {
      permissions: true,
      bindings: {
        include: {
          function: {
            include: {
              department: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  return profile;
});
