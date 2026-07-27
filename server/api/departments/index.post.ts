import { DepartmentFunctionScope, PermissionAction } from '@prisma/client';
import { z } from 'zod';
import type { UserPermissionContext } from '~~/shared/types/rbac';

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
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'departments', PermissionAction.CREATE);
  assertGlobalScope(rbac, 'departments');

  const parsed = departmentSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const hasScopeDivision = body.hasScopeDivision !== false;

  const functions = normalizeDepartmentFunctions(body.functions, hasScopeDivision).map(
    ({ name, description, scope, sortOrder }) => ({
      name,
      description,
      scope,
      sortOrder,
    }),
  );

  const localNamesPayload = normalizeDepartmentLocalNames(body.localNames);

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
