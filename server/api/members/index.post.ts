import { DepartmentScope, MemberStatus, MaritalStatus } from '@prisma/client';
import { z } from 'zod';
import prisma from '#server/utils/prisma';

const departmentSchema = z.object({
  departmentId: z.string().min(1),
  scope: z.nativeEnum(DepartmentScope).optional().nullable(),
  functionId: z.string().optional().nullable(),
  congregationId: z.string().optional().nullable(),
});

const memberSchema = z.object({
  name: z.string().min(1),
  congregationId: z.string().min(1),
  status: z.nativeEnum(MemberStatus),
  dateOfBirth: z.string().min(1),
  memberSince: z.string().min(1),
  convertionDate: z.string().min(1),
  ssn: z.string().min(1),
  nationalId: z.string().min(1),
  maritalStatus: z.nativeEnum(MaritalStatus),
  addressLinePrimary: z.string().min(1),
  district: z.string().min(1),
  motherName: z.string().min(1),
  fatherName: z.string().min(1),
  naturality: z.string().min(1),
  nationality: z.string().min(1),
  phonePrimary: z.string().min(1),
  phoneSecondary: z.string().min(1),
  observations: z.string().min(1),
  departments: z.array(departmentSchema).optional().default([]),
});

export default defineEventHandler(async (event) => {
  const parsed = memberSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const { status } = body;

  const rawDepartments = body.departments;
  const departmentIds = rawDepartments.map((d) => d.departmentId).filter(Boolean);

  const departments = await prisma.department.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, hasScopeDivision: true },
  });
  const departmentById = new Map(departments.map((d) => [d.id, d.hasScopeDivision]));

  const departmentsInput = rawDepartments.map((d) => {
    if (!departmentById.has(d.departmentId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid departmentId' });
    }

    const hasScopeDivision = departmentById.get(d.departmentId) ?? true;
    const scope = hasScopeDivision ? (d.scope ?? null) : null;

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
      dateOfBirth: new Date(body.dateOfBirth),
      memberSince: new Date(body.memberSince),
      convertionDate: new Date(body.convertionDate),
      ssn: body.ssn,
      nationalId: body.nationalId,
      maritalStatus: body.maritalStatus,
      addressLinePrimary: body.addressLinePrimary,
      district: body.district,
      motherName: body.motherName,
      fatherName: body.fatherName,
      naturality: body.naturality,
      nationality: body.nationality,
      phonePrimary: body.phonePrimary,
      phoneSecondary: body.phoneSecondary,
      observations: body.observations,
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
