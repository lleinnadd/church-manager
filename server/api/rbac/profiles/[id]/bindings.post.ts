import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';
import { rbacBindingSchema } from '~~/shared/validation/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'rbac', PermissionAction.MANAGE);

  const profileId = getRouterParam(event, 'id');

  const profile = await prisma.rbacProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  const parsed = rbacBindingSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const { functionId, scope } = parsed.data;

  const fn = await prisma.departmentFunction.findUnique({ where: { id: functionId } });
  if (!fn) {
    throw createError({ statusCode: 400, statusMessage: 'Function not found' });
  }

  const binding = await prisma.rbacProfileBinding.create({
    data: {
      profileId: profileId!,
      functionId,
      scope,
    },
    include: {
      function: {
        include: {
          department: { select: { id: true, name: true } },
        },
      },
    },
  });

  return binding;
});
