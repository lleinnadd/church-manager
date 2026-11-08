import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext;
  assertPermission(rbac, 'members', PermissionAction.READ);
  const id = getRouterParam(event, 'id');
  if (!id || !/^[a-f\d]{24}$/i.test(id)) throw createError({ statusCode: 404 });
  const request = await prisma.memberRegistration.findUnique({ where: { id } });
  if (!request) throw createError({ statusCode: 404 });
  assertCongregationAccess(rbac, 'members', request.congregationId);
  const member = request.memberId
    ? await prisma.member.findUnique({
        where: { id: request.memberId },
        select: registrationMemberSelect,
      })
    : null;
  if (member) {
    const scope = await prisma.member.findUnique({
      where: { id: member.id },
      select: { congregationId: true },
    });
    assertCongregationAccess(rbac, 'members', scope?.congregationId);
  }
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { ...request, tokenHash: undefined, member };
});
