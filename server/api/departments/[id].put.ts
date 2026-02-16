import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' });
  }

  const existingDepartment = await prisma.department.findUnique({
    where: { id },
    select: { hasScopeDivision: true },
  });

  if (!existingDepartment) {
    throw createError({ statusCode: 404, statusMessage: 'Department not found' });
  }

  const functions = (Array.isArray(body?.functions) ? body.functions : [])
    .filter((fn: any) => fn?.name?.trim())
    .map((fn: any, index: number) => ({
      id: fn.id as string | undefined,
      name: fn.name.trim(),
      description: fn.description?.trim() || null,
      sortOrder: Number.isFinite(fn.sortOrder) ? Number(fn.sortOrder) : index,
    }));

  const hasScopeDivision = body?.hasScopeDivision !== false;
  const shouldClearScopes = existingDepartment.hasScopeDivision && !hasScopeDivision;

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
    .map(({ name, description, sortOrder }) => ({
      name,
      description,
      sortOrder,
      departmentId: id,
    }));

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
        data: { name: fn.name, description: fn.description, sortOrder: fn.sortOrder },
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
  ]);

  const department = await prisma.department.findUnique({
    where: { id },
    include: { functions: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
  });

  return department;
});
