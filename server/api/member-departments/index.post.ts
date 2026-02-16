import { DepartmentScope } from '@prisma/client';
import prisma from '#server/utils/prisma';

const allowedScopes = Object.values(DepartmentScope);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body?.memberId || !body?.departmentId || !body?.scope) {
    throw createError({
      statusCode: 400,
      statusMessage: 'memberId, departmentId and scope are required',
    });
  }

  const scope = allowedScopes.includes(body.scope)
    ? (body.scope as DepartmentScope)
    : DepartmentScope.LOCAL;

  const functionId = body.functionId ?? null;

  const member = await prisma.member.findUnique({ where: { id: body.memberId } });
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  }

  if (functionId) {
    const fn = await prisma.departmentFunction.findUnique({ where: { id: functionId } });
    if (!fn || fn.departmentId !== body.departmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid department function' });
    }
  }

  let congregationId: string | null = null;

  if (scope === DepartmentScope.LOCAL) {
    congregationId = body.congregationId || member.congregationId;

    if (!congregationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'congregationId is required for local scope',
      });
    }

    if (member.congregationId && member.congregationId !== congregationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Member must belong to the same congregation for local scope',
      });
    }
  }

  try {
    const membership = await prisma.memberDepartment.create({
      data: {
        memberId: body.memberId,
        departmentId: body.departmentId,
        scope,
        functionId,
        congregationId,
      },
      include: {
        function: true,
        department: true,
        congregation: true,
      },
    });

    return membership;
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Membership already exists' });
    }
    throw error;
  }
});
