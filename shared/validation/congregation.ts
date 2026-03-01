import { CongregationType } from '@prisma/client';
import { z } from 'zod';

interface CongregationValidationMessages {
  required: string;
  zipInvalid: string;
}

type CongregationValidationMessageOverrides = Partial<CongregationValidationMessages>;

const defaultMessages: CongregationValidationMessages = {
  required: 'Required field',
  zipInvalid: 'Invalid zip code',
};

const resolveMessages = (
  overrides?: CongregationValidationMessageOverrides,
): CongregationValidationMessages => ({
  ...defaultMessages,
  ...overrides,
});

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const createCongregationSchema = (messages?: CongregationValidationMessageOverrides) => {
  const resolved = resolveMessages(messages);

  return z.object({
    name: z.string().min(1, { message: resolved.required }),
    type: z.nativeEnum(CongregationType, { required_error: resolved.required }),
    since: z.string().optional().nullable(),
    zipCode: z
      .string()
      .optional()
      .nullable()
      .refine((value) => !value || digitsOnly(value).length === 8, {
        message: resolved.zipInvalid,
      }),
    addressLinePrimary: z.string().optional().nullable(),
    addressLineSecondary: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
  });
};

export type CongregationSchemaInput = z.input<ReturnType<typeof createCongregationSchema>>;
export type CongregationSchemaOutput = z.output<ReturnType<typeof createCongregationSchema>>;
