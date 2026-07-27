import type { UserPermissionContext } from '~~/shared/types/rbac';
import { rbacBindingSchema, rbacBindingBatchSchema } from '~~/shared/validation/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertAdmin(rbac);

  const profileId = getRouterParam(event, 'id');

  const profile = await prisma.rbacProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  const rawBody = await readBody(event);

  // Accept a batch `{ bindings: [...] }` or a legacy single `{ functionId, scope }`.
  const batch = rbacBindingBatchSchema.safeParse(rawBody);
  const single = batch.success ? null : rbacBindingSchema.safeParse(rawBody);

  if (!batch.success && !single?.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const incoming = batch.success ? batch.data.bindings : [single!.data!];
  const uniqueBindings = dedupeBindings(incoming);

  const functionIds = [...new Set(uniqueBindings.map((b) => b.functionId))];
  const found = await prisma.departmentFunction.count({ where: { id: { in: functionIds } } });
  if (found !== functionIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'One or more functions not found' });
  }

  const existing = await prisma.rbacProfileBinding.findMany({
    where: { profileId: profileId! },
    select: { functionId: true, scope: true },
  });
  const existingKeys = new Set(existing.map((b) => `${b.functionId}:${b.scope}`));

  const toCreate = uniqueBindings.filter((b) => !existingKeys.has(`${b.functionId}:${b.scope}`));

  if (toCreate.length) {
    await prisma.rbacProfileBinding.createMany({
      data: toCreate.map((b) => ({
        profileId: profileId!,
        functionId: b.functionId,
        scope: b.scope,
      })),
    });
  }

  return prisma.rbacProfileBinding.findMany({
    where: { profileId: profileId! },
    include: {
      function: {
        include: {
          department: { select: { id: true, name: true } },
        },
      },
    },
  });
});
