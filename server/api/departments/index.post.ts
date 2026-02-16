import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const functions = (Array.isArray(body?.functions) ? body.functions : [])
    .filter((fn: any) => fn?.name?.trim())
    .map((fn: any) => ({
      name: fn.name.trim(),
      description: fn.description?.trim() || null,
    }));

  const hasScopeDivision = body?.hasScopeDivision !== false;

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
    },
    include: {
      functions: true,
    },
  });

  return department;
});
