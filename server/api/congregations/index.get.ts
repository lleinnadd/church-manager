import { CongregationType, PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const congregationTypePriority: Record<CongregationType, number> = {
  [CongregationType.HEADQUARTERS]: 0,
  [CongregationType.BRANCH]: 1,
  [CongregationType.SUB_BRANCH]: 2,
};

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'congregations', PermissionAction.READ);

  const congregationFilter = getCongregationFilter(rbac, 'congregations', 'id');

  const congregations = await prisma.congregation.findMany({
    where: congregationFilter,
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  const leadershipMap = await getCongregationLeadershipMap(
    prisma,
    congregations.map((congregation) => congregation.id),
  );

  return congregations
    .map((congregation) => ({
      ...congregation,
      leadership: leadershipMap.get(congregation.id) ?? null,
    }))
    .sort((a, b) => {
      const typeOrderA = congregationTypePriority[a.type] ?? Number.MAX_SAFE_INTEGER;
      const typeOrderB = congregationTypePriority[b.type] ?? Number.MAX_SAFE_INTEGER;

      if (typeOrderA !== typeOrderB) {
        return typeOrderA - typeOrderB;
      }

      return a.name.localeCompare(b.name, 'pt-BR');
    });
});
