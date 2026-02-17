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

  const localNames = (Array.isArray(body?.localNames) ? body.localNames : [])
    .filter((entry: any) => entry?.congregationId && entry?.name?.trim())
    .map((entry: any) => ({
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
