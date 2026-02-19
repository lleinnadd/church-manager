import { DepartmentFunctionScope } from '@prisma/client';
import { z } from 'zod';
import type { Composer } from 'vue-i18n';

const requiredMessage = (t: Composer['t']) => t('validation.required');

export const buildDepartmentFormSchema = (t: Composer['t']) => {
  const required = requiredMessage(t);

  return z.object({
    name: z.string().min(1, { message: required }),
    description: z.string().optional(),
    hasScopeDivision: z.boolean().optional(),
    functions: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().min(1, { message: required }),
          description: z.string().optional(),
          sortOrder: z.number().optional(),
          scope: z.nativeEnum(DepartmentFunctionScope).optional().nullable(),
        }),
      )
      .optional()
      .default([]),
    localNames: z
      .array(
        z.object({
          id: z.string().optional(),
          congregationId: z.string().min(1, { message: required }),
          name: z.string().min(1, { message: required }),
        }),
      )
      .optional()
      .default([]),
  });
};
