import { DepartmentFunctionScope } from '@prisma/client';
import { z } from 'zod';
import prisma from '#server/utils/prisma';

const departmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  hasScopeDivision: z.boolean().optional(),
  functions: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        description: z.string().optional().nullable(),
        sortOrder: z.number().optional(),
        scope: z.nativeEnum(DepartmentFunctionScope).optional().nullable(),
      }),
    )
    .optional()
    .default([]),
  localNames: z
    .array(
      z.object({
        congregationId: z.string(),
        name: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Department id is required' });
  }
  const parsed = departmentSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const existingDepartment = await prisma.department.findUnique({
    where: { id },
    select: { hasScopeDivision: true },
  });

  if (!existingDepartment) {
    throw createError({ statusCode: 404, statusMessage: 'Department not found' });
  }

  const localNames = body.localNames
    .filter((entry) => entry.congregationId && entry.name.trim())
    .map((entry) => ({
      congregationId: entry.congregationId,
      name: entry.name.trim(),
    }));

  const localNamesByCongregation = new Map<string, string>();
  localNames.forEach((entry) => {
    localNamesByCongregation.set(entry.congregationId, entry.name);
  });
  const normalizedLocalNames = Array.from(localNamesByCongregation, ([congregationId, name]) => ({
    congregationId,
    name,
  }));

  const hasScopeDivision = body.hasScopeDivision !== false;
  const shouldClearScopes = existingDepartment.hasScopeDivision && !hasScopeDivision;

  const functions = body.functions
    .filter((fn) => fn.name.trim())
    .map((fn, index) => ({
      id: fn.id,
      name: fn.name.trim(),
      description: fn.description?.trim() || null,
      scope: hasScopeDivision ? (fn.scope ?? DepartmentFunctionScope.BOTH) : null,
      sortOrder: Number.isFinite(fn.sortOrder) ? Number(fn.sortOrder) : index,
    }));

  const existingFunctions = await prisma.departmentFunction.findMany({
    where: { departmentId: id },
  });

  const incomingIds = functions.filter((fn) => fn.id).map((fn) => fn.id!);
  const toDeleteIds = existingFunctions
    .filter((fn) => !incomingIds.includes(fn.id))
    .map((fn) => fn.id);

  const updates = functions.filter((fn) => fn.id);
  const creations = functions
    .filter((fn) => !fn.id)
    .map(({ name, description, scope, sortOrder }) => ({
      name,
      description,
      scope,
      sortOrder,
      departmentId: id,
    }));

  const existingLocalNames = await prisma.departmentLocalName.findMany({
    where: { departmentId: id },
  });

  const incomingLocalNamesByCongregation = new Map(
    normalizedLocalNames.map((entry) => [entry.congregationId, entry]),
  );

  const localNamesToDelete = existingLocalNames
    .filter((entry) => !incomingLocalNamesByCongregation.has(entry.congregationId))
    .map((entry) => entry.id);

  await prisma.$transaction([
    prisma.department.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        hasScopeDivision,
      },
    }),
    ...(shouldClearScopes
      ? [
          prisma.memberDepartment.updateMany({
            where: { departmentId: id },
            data: { scope: null, congregationId: null },
          }),
        ]
      : []),
    ...updates.map((fn) =>
      prisma.departmentFunction.update({
        where: { id: fn.id },
        data: {
          name: fn.name,
          description: fn.description,
          scope: fn.scope,
          sortOrder: fn.sortOrder,
        },
      }),
    ),
    ...(creations.length ? [prisma.departmentFunction.createMany({ data: creations })] : []),
    ...(toDeleteIds.length
      ? [
          prisma.memberDepartment.updateMany({
            where: { functionId: { in: toDeleteIds } },
            data: { functionId: null },
          }),
          prisma.departmentFunction.deleteMany({ where: { id: { in: toDeleteIds } } }),
        ]
      : []),
    ...normalizedLocalNames.map((entry) =>
      prisma.departmentLocalName.upsert({
        where: {
          departmentId_congregationId: {
            departmentId: id,
            congregationId: entry.congregationId,
          },
        },
        update: { name: entry.name },
        create: {
          departmentId: id,
          congregationId: entry.congregationId,
          name: entry.name,
        },
      }),
    ),
    ...(localNamesToDelete.length
      ? [prisma.departmentLocalName.deleteMany({ where: { id: { in: localNamesToDelete } } })]
      : []),
  ]);

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      functions: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      localNames: {
        include: { congregation: { select: { id: true, name: true, type: true } } },
        orderBy: { name: 'asc' },
      },
    },
  });

  return department;
});
