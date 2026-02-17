import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const functions = (Array.isArray(body?.functions) ? body.functions : [])
    .filter((fn: any) => fn?.name?.trim())
    .map((fn: any, index: number) => ({
      name: fn.name.trim(),
      description: fn.description?.trim() || null,
      sortOrder: Number.isFinite(fn.sortOrder) ? Number(fn.sortOrder) : index,
    }));

  const hasScopeDivision = body?.hasScopeDivision !== false;

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
  const localNamesPayload = Array.from(localNamesByCongregation, ([congregationId, name]) => ({
    congregationId,
    name,
  }));

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' });
  }

  const department = await prisma.department.create({
    data: {
      name: body.name,
      description: body.description || null,
      hasScopeDivision,
      functions: functions.length
        ? {
            create: functions,
          }
        : undefined,
      localNames: localNamesPayload.length
        ? {
            createMany: {
              data: localNamesPayload,
            },
          }
        : undefined,
    },
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
