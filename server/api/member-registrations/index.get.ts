import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext;
  assertPermission(rbac, 'members', PermissionAction.READ);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  const requests = await prisma.memberRegistration.findMany({
    where: {
      ...getCongregationFilter(rbac, 'members'),
      status: { in: ['OPEN', 'PENDING', 'APPROVED'] },
    },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      memberId: true,
      congregationId: true,
      status: true,
      submittedAt: true,
      submission: true,
    },
  });
  return requests.filter((request) => request.submission !== null);
});
