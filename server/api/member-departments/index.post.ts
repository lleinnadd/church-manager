import { DepartmentScope, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '#server/utils/prisma';

const memberDepartmentSchema = z.object({
  memberId: z.string().min(1),
  departmentId: z.string().min(1),
  scope: z.nativeEnum(DepartmentScope).optional(),
  functionId: z.string().optional().nullable(),
  congregationId: z.string().optional().nullable(),
});

export default defineEventHandler(async (event) => {
  const parsed = memberDepartmentSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const department = await prisma.department.findUnique({
    where: { id: body.departmentId },
    select: { id: true, hasScopeDivision: true },
  });

  if (!department) {
    throw createError({ statusCode: 404, statusMessage: 'Department not found' });
  }

  const { hasScopeDivision } = department;
  const scope = hasScopeDivision ? (body.scope ?? null) : null;

  if (hasScopeDivision && !scope) {
    throw createError({ statusCode: 400, statusMessage: 'scope is required for this department' });
  }

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

  if (hasScopeDivision && scope === DepartmentScope.LOCAL) {
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
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Membership already exists' });
    }
    throw error;
  }
});
