import { PermissionAction } from '@prisma/client';
import { clerkClient } from '@clerk/nuxt/server';
import { isClerkAPIResponseError } from '@clerk/nuxt/errors';
import type { UserPermissionContext } from '~~/shared/types/rbac';
import { deleteLocalMember } from '../../utils/member-deletion';

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
    select: { clerkUserId: true, congregationId: true },
  });

  if (member) {
    assertCongregationAccess(rbac, 'members', member.congregationId);
  }

  if (member?.clerkUserId && member.clerkUserId === auth.userId) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot delete your own profile' });
  }

  if (member?.clerkUserId) {
    try {
      await clerkClient(event).users.deleteUser(member.clerkUserId);
    } catch (error) {
      const alreadyDeleted =
        error != null &&
        isClerkAPIResponseError(error) &&
        error.status === 404 &&
        error.errors.some((entry) => entry.code === 'resource_not_found');

      if (!alreadyDeleted) {
        throw createError({
          statusCode: 502,
          statusMessage: 'Failed to delete linked account. Please try again.',
          cause: error,
        });
      }
    }
  }

  await deleteLocalMember({ id });

  return { success: true };
});
