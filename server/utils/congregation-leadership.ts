import { DepartmentFunctionScope, DepartmentScope } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const BOARD_DEPARTMENT_NAME = 'Diretoria';

export interface CongregationResponsible {
  memberId: string;
  memberName: string;
  functionId: string;
  functionName: string;
}

export interface CongregationLeadershipData {
  departmentId: string;
  departmentName: string;
  responsibles: CongregationResponsible[];
}

interface BoardMembership {
  congregationId: string;
  memberId: string;
  memberName: string;
  functionId: string;
  functionName: string;
  functionSortOrder: number;
}

function compareBoardMembership(a: BoardMembership, b: BoardMembership) {
  if (a.functionSortOrder !== b.functionSortOrder) {
    return a.functionSortOrder - b.functionSortOrder;
  }

  return a.functionName.localeCompare(b.functionName, 'pt-BR');
}

export async function getCongregationLeadershipMap(
  prismaClient: Pick<PrismaClient, 'department' | 'memberDepartment'>,
  congregationIds: string[],
): Promise<Map<string, CongregationLeadershipData | null>> {
  const map = new Map<string, CongregationLeadershipData | null>();

  if (!congregationIds.length) {
    return map;
  }

  const boardDepartment = await prismaClient.department.findFirst({
    where: { name: BOARD_DEPARTMENT_NAME },
    select: { id: true, name: true },
  });

  if (!boardDepartment) {
    congregationIds.forEach((congregationId) => {
      map.set(congregationId, null);
    });
    return map;
  }

  const memberships = await prismaClient.memberDepartment.findMany({
    where: {
      departmentId: boardDepartment.id,
      scope: DepartmentScope.LOCAL,
      functionId: { not: null },
      OR: [
        { congregationId: { in: congregationIds } },
        {
          AND: [{ congregationId: null }, { member: { congregationId: { in: congregationIds } } }],
        },
      ],
    },
    include: {
      member: { select: { id: true, name: true, congregationId: true } },
      function: { select: { id: true, name: true, sortOrder: true, scope: true } },
    },
  });

  const grouped = memberships.reduce<Map<string, BoardMembership[]>>((acc, membership) => {
    if (!membership.member || !membership.function || !membership.functionId) {
      return acc;
    }

    if (membership.function.scope === DepartmentFunctionScope.GENERAL) {
      return acc;
    }

    const resolvedCongregationId = membership.congregationId ?? membership.member.congregationId;
    if (!resolvedCongregationId || !congregationIds.includes(resolvedCongregationId)) {
      return acc;
    }

    const current = acc.get(resolvedCongregationId) ?? [];
    current.push({
      congregationId: resolvedCongregationId,
      memberId: membership.member.id,
      memberName: membership.member.name,
      functionId: membership.function.id,
      functionName: membership.function.name,
      functionSortOrder: membership.function.sortOrder,
    });
    acc.set(resolvedCongregationId, current);
    return acc;
  }, new Map<string, BoardMembership[]>());

  congregationIds.forEach((congregationId) => {
    const responsibles = (grouped.get(congregationId) ?? [])
      .sort(compareBoardMembership)
      .map((entry) => ({
        memberId: entry.memberId,
        memberName: entry.memberName,
        functionId: entry.functionId,
        functionName: entry.functionName,
      }));

    map.set(congregationId, {
      departmentId: boardDepartment.id,
      departmentName: boardDepartment.name,
      responsibles,
    });
  });

  return map;
}

export async function getCongregationLeadership(
  prismaClient: Pick<PrismaClient, 'department' | 'memberDepartment'>,
  congregationId: string,
): Promise<CongregationLeadershipData | null> {
  const map = await getCongregationLeadershipMap(prismaClient, [congregationId]);
  return map.get(congregationId) ?? null;
}
