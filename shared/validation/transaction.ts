import { TransactionType } from '@prisma/client';
import { z } from 'zod';

interface TransactionValidationMessages {
  required: string;
  amountPositive: string;
}

type TransactionValidationMessageOverrides = Partial<TransactionValidationMessages>;

const defaultMessages: TransactionValidationMessages = {
  required: 'Required field',
  amountPositive: 'Amount must be greater than zero',
};

const resolveMessages = (
  overrides?: TransactionValidationMessageOverrides,
): TransactionValidationMessages => ({
  ...defaultMessages,
  ...overrides,
});

export const createTransactionSchema = (messages?: TransactionValidationMessageOverrides) => {
  const resolved = resolveMessages(messages);

  return z.object({
    name: z.string().min(1, { message: resolved.required }),
    type: z.nativeEnum(TransactionType, { required_error: resolved.required }),
    amount: z
      .number({ required_error: resolved.required })
      .positive({ message: resolved.amountPositive }),
    date: z.string().min(1, { message: resolved.required }),
    categoryId: z.string().optional().nullable(),
    congregationId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });
};

export type TransactionSchemaInput = z.input<ReturnType<typeof createTransactionSchema>>;
export type TransactionSchemaOutput = z.output<ReturnType<typeof createTransactionSchema>>;

export const transactionCategorySchema = z.object({
  name: z.string().min(2),
});

export const treasuryConfigSchema = z.object({
  initialBalance: z.number(),
  initialBalanceDate: z.string().min(1),
  congregationId: z.string().optional().nullable(),
});
