import { z } from 'zod';
import prisma from '#server/utils/prisma';

const departmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  hasScopeDivision: z.boolean().optional(),
  functions: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional().nullable(),
        sortOrder: z.number().optional(),
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
  const parsed = departmentSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const functions = body.functions
    .filter((fn) => fn.name.trim())
    .map((fn, index) => ({
      name: fn.name.trim(),
      description: fn.description?.trim() || null,
      sortOrder: Number.isFinite(fn.sortOrder) ? Number(fn.sortOrder) : index,
    }));

  const hasScopeDivision = body.hasScopeDivision !== false;

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
  const localNamesPayload = Array.from(localNamesByCongregation, ([congregationId, name]) => ({
    congregationId,
    name,
  }));

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
