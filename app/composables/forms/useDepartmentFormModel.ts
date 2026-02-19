import { DepartmentFunctionScope, type Congregation } from '@prisma/client';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { computed, watch, type Ref } from 'vue';
import type {
  DepartmentFormData,
  DepartmentFormPayload,
  DepartmentFunctionInput,
  DepartmentLocalNameInput,
} from '@/types/forms';
import { buildDepartmentFormSchema } from '@/lib/validation';

type FunctionInput = DepartmentFunctionInput & { description?: string | null; sortOrder?: number };

type LocalNameInput = DepartmentLocalNameInput;

function resolveFunctionScope(
  scope: DepartmentFunctionScope | null | undefined,
  hasScopeDivision: boolean,
) {
  return hasScopeDivision ? (scope ?? DepartmentFunctionScope.BOTH) : null;
}

function normalizeSortOrder(nextFunctions: FunctionInput[]) {
  return nextFunctions.map((fn, index) => ({
    ...fn,
    description: fn.description ?? '',
    sortOrder: index,
  }));
}

export const useDepartmentFormModel = (initialData: Ref<DepartmentFormData | undefined>) => {
  const { t } = useI18n();

  const { data: congregations, status: congregationsStatus } =
    useFetch<Congregation[]>('/api/congregations');

  const buildInitialValues = (data?: DepartmentFormData): DepartmentFormPayload => ({
    name: data?.name ?? '',
    description: data?.description ?? '',
    hasScopeDivision: data?.hasScopeDivision ?? true,
    functions:
      data?.functions
        ?.map((fn, index) => ({
          id: fn.id,
          name: fn.name,
          description: fn.description ?? '',
          scope: resolveFunctionScope(fn.scope, data?.hasScopeDivision ?? true),
          sortOrder: Number.isFinite(fn.sortOrder) ? Number(fn.sortOrder) : index,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) ?? [],
    localNames:
      data?.localNames?.map((entry) => ({
        id: entry.id,
        congregationId: entry.congregationId,
        name: entry.name,
      })) ?? [],
  });

  const validationSchema = computed(() => toTypedSchema(buildDepartmentFormSchema(t)));

  const { handleSubmit, setFieldValue, values, errors, submitCount, resetForm } =
    useForm<DepartmentFormPayload>({
      validationSchema,
      initialValues: buildInitialValues(initialData.value),
    });

  const functions = computed(() => values.functions ?? []);
  const localNames = computed(() => values.localNames ?? []);

  const hasAvailableCongregation = computed(() => {
    const options = congregations.value ?? [];
    if (!options.length) return false;
    const used = new Set(
      localNames.value.map((entry: LocalNameInput) => entry.congregationId).filter(Boolean),
    );
    return options.some((item) => !used.has(item.id));
  });

  watch(
    initialData,
    (value) => {
      resetForm({ values: buildInitialValues(value) });
      const next = normalizeSortOrder(buildInitialValues(value).functions as FunctionInput[]);
      setFieldValue('functions', next);
    },
    { immediate: true, deep: true },
  );

  watch(
    () => values.hasScopeDivision,
    (hasScopeDivision) => {
      const next = functions.value.map((fn) => ({
        ...fn,
        description: fn.description ?? '',
        scope: resolveFunctionScope(fn.scope, hasScopeDivision !== false),
      }));
      setFieldValue('functions', next);
    },
  );

  function addFunction() {
    const next = [...functions.value];
    next.push({
      id: undefined,
      name: '',
      description: '',
      scope: resolveFunctionScope(null, values.hasScopeDivision !== false),
      sortOrder: next.length,
    });
    setFieldValue('functions', next);
  }

  function removeFunction(index: number) {
    const next = [...functions.value];
    next.splice(index, 1);
    setFieldValue('functions', normalizeSortOrder(next));
  }

  function moveFunction(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= functions.value.length) return;
    const next = [...functions.value];
    const current = next[index];
    const target = next[targetIndex];
    if (!current || !target) return;
    next.splice(index, 1, target);
    next.splice(targetIndex, 1, current);
    setFieldValue('functions', normalizeSortOrder(next));
  }

  function nextAvailableCongregationId(): string {
    const used = new Set(
      localNames.value.map((entry: LocalNameInput) => entry.congregationId).filter(Boolean),
    );
    const options = congregations.value ?? [];
    const available = options.find((item) => !used.has(item.id));
    return available?.id ?? options[0]?.id ?? '';
  }

  function addLocalName() {
    const next = [...localNames.value];
    next.push({
      id: undefined,
      congregationId: nextAvailableCongregationId(),
      name: '',
    });
    setFieldValue('localNames', next);
  }

  function removeLocalName(index: number) {
    const next = [...localNames.value];
    next.splice(index, 1);
    setFieldValue('localNames', next);
  }

  function isCongregationTaken(congregationId: string, index: number): boolean {
    if (!congregationId) return false;
    return localNames.value.some(
      (entry: LocalNameInput, idx: number) =>
        idx !== index && entry.congregationId === congregationId,
    );
  }

  const toPayload = (formValues: DepartmentFormPayload): DepartmentFormPayload => ({
    ...formValues,
    functions: formValues.functions.map((fn, index) => ({
      ...fn,
      scope: resolveFunctionScope(fn.scope, formValues.hasScopeDivision !== false),
      sortOrder: index,
    })),
    localNames: formValues.localNames
      .filter((entry) => entry.congregationId && entry.name.trim())
      .map((entry) => ({
        id: entry.id,
        congregationId: entry.congregationId,
        name: entry.name.trim(),
      })),
  });

  return {
    congregations,
    congregationsStatus,
    values,
    errors,
    submitCount,
    functions,
    localNames,
    hasAvailableCongregation,
    handleSubmit,
    addFunction,
    removeFunction,
    moveFunction,
    addLocalName,
    removeLocalName,
    isCongregationTaken,
    toPayload,
  };
};
