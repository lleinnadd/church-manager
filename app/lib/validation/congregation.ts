import { CongregationType } from '@prisma/client';
import { z } from 'zod';
import type { Composer } from 'vue-i18n';

const requiredMessage = (t: Composer['t']) => t('validation.required');
const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const buildCongregationFormSchema = (t: Composer['t']) => {
  const required = requiredMessage(t);

  return z.object({
    name: z.string().min(1, { message: required }),
    type: z.nativeEnum(CongregationType, { required_error: required }),
    since: z.string().optional(),
    zipCode: z
      .string()
      .optional()
      .refine((value) => !value || digitsOnly(value).length === 8, {
        message: t('validation.zipInvalid'),
      }),
    addressLinePrimary: z.string().optional(),
    addressLineSecondary: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
  });
};
