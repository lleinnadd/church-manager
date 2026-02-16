import { MemberStatus } from '@prisma/client';
import prisma from '#server/utils/prisma';

const allowedStatus = Object.values(MemberStatus);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body?.name || !body?.congregationId) {
    throw createError({ statusCode: 400, statusMessage: 'name and congregationId are required' });
  }

  const status = allowedStatus.includes(body.status)
    ? (body.status as MemberStatus)
    : MemberStatus.ACTIVE;

  const departmentsInput = (body.departments || []).map((d: any) => ({
    departmentId: d.departmentId,
    scope: d.scope,
    functionId: d.functionId || null,
    congregationId: d.scope === 'LOCAL' ? d.congregationId || body.congregationId : null,
  }));

  const functionIds = departmentsInput.map((d) => d.functionId).filter(Boolean) as string[];
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
      (d) => d.functionId && fnById.get(d.functionId) !== d.departmentId,
    );
    if (mismatch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Function does not belong to department',
      });
    }
  }

  const member = await prisma.member.create({
    data: {
      name: body.name,
      congregationId: body.congregationId,
      status,
      clerkUserId: null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      memberSince: body.memberSince ? new Date(body.memberSince) : null,
      convertionDate: body.convertionDate ? new Date(body.convertionDate) : null,
      departments: {
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
