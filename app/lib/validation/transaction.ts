import { z } from 'zod';
import type { Composer } from 'vue-i18n';

const requiredMessage = (t: Composer['t']) => t('validation.required');

export const buildTransactionFormSchema = (t: Composer['t']) => {
  const required = requiredMessage(t);

  return z.object({
    name: z.string({ required_error: required }).min(1, { message: required }),
    type: z.enum(['INCOME', 'EXPENSE'] as const, {
      required_error: required,
      invalid_type_error: required,
    }),
    amount: z
      .number({ required_error: required, invalid_type_error: required })
      .positive({ message: t('validation.amountPositive') }),
    date: z.string({ required_error: required }).min(1, { message: required }),
    categoryId: z.string().optional().nullable(),
    congregationId: z.string({ required_error: required }).min(1, { message: required }),
    notes: z.string().optional().nullable(),
  });
};
