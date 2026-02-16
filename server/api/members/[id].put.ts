import { DepartmentScope, MemberStatus } from '@prisma/client';
import prisma from '#server/utils/prisma';

const allowedStatus = Object.values(MemberStatus);
const allowedScopes = Object.values(DepartmentScope);

interface DepartmentPayload {
  departmentId: string;
  scope: string;
  functionId?: string | null;
  congregationId?: string | null;
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  const existing = await prisma.member.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  }

  const isClerkManaged = Boolean(existing.clerkUserId);

  const requestedStatus = allowedStatus.includes(body.status)
    ? (body.status as MemberStatus)
    : undefined;
  const status = isClerkManaged ? MemberStatus.ACTIVE : requestedStatus;

  const rawDepartments = Array.isArray(body.departments) ? body.departments : [];

  const departmentIds = rawDepartments
    .map((d: DepartmentPayload) => d.departmentId)
    .filter(Boolean);
  const departments = await prisma.department.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, hasScopeDivision: true },
  });
  const departmentById = new Map(departments.map((d) => [d.id, d.hasScopeDivision]));

  const departmentsInput = rawDepartments.map((d: DepartmentPayload) => {
    if (!departmentById.has(d.departmentId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid departmentId' });
    }

    const hasScopeDivision = departmentById.get(d.departmentId) ?? true;
    const scope =
      hasScopeDivision && allowedScopes.includes(d.scope) ? (d.scope as DepartmentScope) : null;

    if (hasScopeDivision && !scope) {
      throw createError({
        statusCode: 400,
        statusMessage: 'scope is required for this department',
      });
    }

    const congregationId =
      hasScopeDivision && scope === DepartmentScope.LOCAL
        ? d.congregationId || body.congregationId
        : null;

    if (hasScopeDivision && scope === DepartmentScope.LOCAL && !congregationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'congregationId is required for local scope',
      });
    }

    return {
      departmentId: d.departmentId,
      scope,
      functionId: d.functionId || null,
      congregationId,
    };
  });

  const functionIds = departmentsInput
    .map((d: DepartmentPayload) => d.functionId)
    .filter(Boolean) as string[];
  if (functionIds.length) {
    const functions = await prisma.departmentFunction.findMany({
      where: { id: { in: functionIds } },
      select: { id: true, departmentId: true },
    });
    if (functions.length !== functionIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid functionId' });
    }
    const fnById = new Map(functions.map((f) => [f.id, f.departmentId]));
    const mismatch = departmentsInput.find(
      (d: DepartmentPayload) => d.functionId && fnById.get(d.functionId) !== d.departmentId,
    );
    if (mismatch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Function does not belong to department',
      });
    }
  }

  const member = await prisma.member.update({
    where: { id },
    data: {
      name: isClerkManaged ? undefined : body.name,
      congregationId: body.congregationId,
      status,
      clerkUserId: undefined,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      memberSince: body.memberSince ? new Date(body.memberSince) : undefined,
      convertionDate: body.convertionDate ? new Date(body.convertionDate) : undefined,
      departments: {
        deleteMany: {},
        create: departmentsInput,
      },
    },
    include: {
      departments: {
        include: {
          department: true,
          function: true,
          congregation: { select: { id: true, name: true, type: true } },
        },
      },
      congregation: { select: { id: true, name: true, type: true } },
    },
  });

  return member;
});
