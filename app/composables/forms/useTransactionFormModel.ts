import type { Congregation } from '@prisma/client';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import type { TransactionFormData, TransactionFormPayload } from '@/types/forms';
import { buildTransactionFormSchema } from '@/lib/validation';

function normalizeInitialValues(data?: TransactionFormData): TransactionFormPayload {
  return {
    name: data?.name ?? '',
    type: data?.type ?? 'EXPENSE',
    amount: data?.amount ?? 0,
    date: data?.date ?? new Date().toISOString().slice(0, 16),
    categoryId: data?.categoryId ?? null,
    congregationId: data?.congregationId ?? null,
    notes: data?.notes ?? null,
  };
}

export const useTransactionFormModel = (initialData: Ref<TransactionFormData | undefined>) => {
  const { t } = useI18n();

  const validationSchema = computed(() => toTypedSchema(buildTransactionFormSchema(t)));

  const { values, errors, submitCount, setFieldValue, handleSubmit, resetForm } =
    useForm<TransactionFormPayload>({
      validationSchema,
      initialValues: normalizeInitialValues(initialData.value),
    });

  watch(
    initialData,
    (value) => {
      resetForm({ values: normalizeInitialValues(value) });
    },
    { immediate: true, deep: true },
  );

  const { data: congregations, status: congregationsStatus } =
    useFetch<Congregation[]>('/api/congregations');

  const isExpense = computed(() => values.type === 'EXPENSE');

  const toPayload = (formValues: TransactionFormPayload): TransactionFormPayload => ({
    ...formValues,
    notes: formValues.notes?.trim() || null,
    categoryId: formValues.categoryId || null,
    congregationId: formValues.congregationId || null,
  });

  return {
    values,
    errors,
    submitCount,
    congregations,
    congregationsStatus,
    isExpense,
    handleSubmit,
    setFieldValue,
    toPayload,
  };
};
