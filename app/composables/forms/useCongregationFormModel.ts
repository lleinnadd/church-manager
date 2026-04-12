import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import type { CongregationFormPayload } from '@/types/forms';
import { buildCongregationFormSchema } from '@/lib/validation';

interface CongregationInitialData {
  name: string;
  type: string;
  since: string | null;
  zipCode: string | null;
  addressLinePrimary: string | null;
  addressLineSecondary: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
}

function parseDate(value: string | null | undefined): DateValue | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export const useCongregationFormModel = (initialData: Ref<CongregationInitialData | undefined>) => {
  const { t, locale } = useI18n();

  const sinceDate = ref<DateValue | undefined>(parseDate(initialData.value?.since));

  const {
    masked: maskedZipCode,
    unmasked: unmaskedZipCode,
    onInput: onZipCodeInput,
  } = useZipCodeMask(initialData.value?.zipCode ?? '');

  const buildInitialValues = (data?: CongregationInitialData): CongregationFormPayload => ({
    name: data?.name ?? '',
    type: (data?.type ?? 'HEADQUARTERS') as CongregationFormPayload['type'],
    since: data?.since ?? '',
    zipCode: data?.zipCode ?? '',
    addressLinePrimary: data?.addressLinePrimary ?? '',
    addressLineSecondary: data?.addressLineSecondary ?? '',
    district: data?.district ?? '',
    city: data?.city ?? '',
    state: data?.state ?? '',
  });

  const validationSchema = computed(() => toTypedSchema(buildCongregationFormSchema(t)));

  const { handleSubmit, setFieldValue, errors, submitCount, resetForm } =
    useForm<CongregationFormPayload>({
      validationSchema,
      initialValues: buildInitialValues(initialData.value),
    });

  watch(initialData, (data) => {
    resetForm({ values: buildInitialValues(data) });
    sinceDate.value = parseDate(data?.since ?? null);
  });

  watchEffect(() => {
    setFieldValue('zipCode', unmaskedZipCode.value);
  });

  watch(sinceDate, (value) => {
    const since = value ? value.toDate(getLocalTimeZone()).toISOString() : '';
    setFieldValue('since', since);
  });

  const congregationTypes = computed(() => {
    return [
      { value: 'HEADQUARTERS', label: t('form.congregation.type.headquarters') },
      { value: 'BRANCH', label: t('form.congregation.type.branch') },
      { value: 'SUB_BRANCH', label: t('form.congregation.type.subBranch') },
    ];
  });

  function formatDateDisplay(date: DateValue | undefined) {
    if (!date) return '';
    return date.toDate(getLocalTimeZone()).toLocaleDateString(locale.value);
  }

  const toPayload = (formValues: CongregationFormPayload): CongregationFormPayload => {
    const since = sinceDate.value ? sinceDate.value.toDate(getLocalTimeZone()).toISOString() : '';
    return { ...formValues, zipCode: unmaskedZipCode.value, since };
  };

  return {
    sinceDate,
    maskedZipCode,
    onZipCodeInput,
    congregationTypes,
    formatDateDisplay,
    errors,
    submitCount,
    handleSubmit,
    toPayload,
  };
};
