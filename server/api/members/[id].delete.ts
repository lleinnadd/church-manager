import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'members', PermissionAction.DELETE);

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Member id is required' });
  }

  const auth = (event.context.auth as () => { userId: string | null })();

  const member = await prisma.member.findUnique({
    where: { id },
    select: { photoBlobPath: true, clerkUserId: true, congregationId: true },
  });

  if (member) {
    assertCongregationAccess(rbac, 'members', member.congregationId);
  }

  if (member?.clerkUserId && member.clerkUserId === auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot delete your own profile' });
  }

  await prisma.memberDepartment.deleteMany({ where: { memberId: id } });
  await prisma.member.delete({ where: { id } });

  if (member?.photoBlobPath) {
    await safeDeleteBlob(member.photoBlobPath);
  }

  return { success: true };
});
