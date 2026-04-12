import { DepartmentScope } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { MemberDepartmentOutput } from '#shared/validation/member';

type MemberDepartmentResolverClient = Pick<PrismaClient, 'department' | 'departmentFunction'>;

const BOARD_DEPARTMENT_NAME = 'Diretoria';

export interface MemberDepartmentWriteInput {
  departmentId: string;
  scope: DepartmentScope | null;
  functionId: string | null;
  congregationId: string | null;
}

export async function resolveMemberDepartmentsInput(
  prismaClient: MemberDepartmentResolverClient,
  departments: MemberDepartmentOutput[],
  memberCongregationId: string,
): Promise<MemberDepartmentWriteInput[]> {
  const departmentIds = departments.map((entry) => entry.departmentId).filter(Boolean);
  const storedDepartments = await prismaClient.department.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, name: true, hasScopeDivision: true },
  });
  const departmentById = new Map(storedDepartments.map((entry) => [entry.id, entry]));

  const normalized = departments.map((entry) => {
    if (!departmentById.has(entry.departmentId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid departmentId' });
    }

    const department = departmentById.get(entry.departmentId);
    const hasScopeDivision = department?.hasScopeDivision ?? true;
    const scope = hasScopeDivision ? (entry.scope ?? null) : null;

    if (hasScopeDivision && !scope) {
      throw createError({
        statusCode: 400,
        statusMessage: 'scope is required for this department',
      });
    }

    const isBoardDepartment = department?.name === BOARD_DEPARTMENT_NAME;

    const congregationId =
      hasScopeDivision && scope === DepartmentScope.LOCAL
        ? entry.congregationId || memberCongregationId
        : null;

    const normalizedCongregationId =
      isBoardDepartment && scope === DepartmentScope.LOCAL ? memberCongregationId : congregationId;

    if (hasScopeDivision && scope === DepartmentScope.LOCAL && !normalizedCongregationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'congregationId is required for local scope',
      });
    }

    return {
      departmentId: entry.departmentId,
      scope,
      functionId: entry.functionId || null,
      congregationId: normalizedCongregationId,
    };
  });

  const functionIds = normalized.map((entry) => entry.functionId).filter(Boolean) as string[];
  if (!functionIds.length) {
    return normalized;
  }

  const functions = await prismaClient.departmentFunction.findMany({
    where: { id: { in: functionIds } },
    select: { id: true, departmentId: true },
  });

  if (functions.length !== functionIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid functionId' });
  }

  const functionDepartmentById = new Map(functions.map((entry) => [entry.id, entry.departmentId]));
  const mismatch = normalized.find(
    (entry) =>
      entry.functionId && functionDepartmentById.get(entry.functionId) !== entry.departmentId,
  );

  if (mismatch) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Function does not belong to department',
    });
  }

  return normalized;
}
