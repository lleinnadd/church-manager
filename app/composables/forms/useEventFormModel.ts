import { EventSeriesType, type Congregation, type Department } from '@prisma/client';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import type { EventFormData, EventFormPayload } from '@/types/forms';
import { buildEventFormSchema } from '@/lib/validation';

function normalizeInitialValues(data?: EventFormData): EventFormPayload {
  return {
    title: data?.title ?? '',
    description: data?.description ?? '',
    congregationId: data?.congregationId ?? '',
    departmentId: data?.departmentId ?? null,
    eventType: data?.eventType ?? EventSeriesType.SINGLE_DAY,
    startsOn: data?.startsOn ?? '',
    endsOn: data?.endsOn ?? '',
    sameTimeStart: data?.sameTimeStart ?? null,
    daySchedules: data?.daySchedules ?? [],
    monthlyRule: data?.monthlyRule ?? null,
  };
}

export const useEventFormModel = (initialData: Ref<EventFormData | undefined>) => {
  const { t } = useI18n();

  const validationSchema = computed(() => toTypedSchema(buildEventFormSchema(t)));

  const { values, errors, submitCount, setFieldValue, handleSubmit, resetForm } =
    useForm<EventFormPayload>({
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

  const { data: departments, status: departmentsStatus } =
    useFetch<Department[]>('/api/departments');

  const daySchedules = computed(() => values.daySchedules ?? []);

  const hasEndDate = computed(() => {
    if (values.eventType === EventSeriesType.MULTI_DAY) return true;
    return Boolean(values.endsOn?.trim());
  });

  function setHasEndDate(value: boolean) {
    if (values.eventType === EventSeriesType.MULTI_DAY) {
      if (!values.endsOn?.trim()) {
        setFieldValue('endsOn', values.startsOn || '');
      }
      return;
    }

    if (!value) {
      setFieldValue('endsOn', null);
      return;
    }

    if (!values.endsOn?.trim()) {
      setFieldValue('endsOn', values.startsOn || '');
    }
  }

  watch(
    () => values.eventType,
    (eventType) => {
      if (eventType === EventSeriesType.SINGLE_DAY) {
        setFieldValue('endsOn', values.startsOn || '');
        return;
      }

      if (eventType === EventSeriesType.MULTI_DAY && !values.endsOn?.trim()) {
        setFieldValue('endsOn', values.startsOn || '');
      }
    },
  );

  const canApplyFirstScheduleToRange = computed(() => {
    if (!values.startsOn || !values.endsOn) return false;
    const first = daySchedules.value[0];
    return Boolean(first?.startTime);
  });

  function addDays(date: Date, amount: number): Date {
    return new Date(date.getTime() + amount * 86400000);
  }

  function applyFirstScheduleToRange() {
    if (!canApplyFirstScheduleToRange.value) return;

    const first = daySchedules.value[0];
    if (!first) return;

    const start = new Date(`${values.startsOn}T00:00:00`);
    const end = new Date(`${values.endsOn}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return;

    const next = [] as NonNullable<EventFormPayload['daySchedules']>;
    let cursor = start;

    while (cursor <= end) {
      next.push({
        date: cursor.toISOString().slice(0, 10),
        startTime: first.startTime,
      });
      cursor = addDays(cursor, 1);
    }

    setFieldValue('daySchedules', next);
  }

  function addDaySchedule() {
    const next = [...daySchedules.value];
    next.push({ date: values.startsOn || '', startTime: '19:00' });
    setFieldValue('daySchedules', next);
  }

  function removeDaySchedule(index: number) {
    const next = [...daySchedules.value];
    next.splice(index, 1);
    setFieldValue('daySchedules', next);
  }

  const toPayload = (formValues: EventFormPayload): EventFormPayload => ({
    ...formValues,
    endsOn: (() => {
      if (formValues.eventType === EventSeriesType.SINGLE_DAY) {
        return formValues.startsOn;
      }

      return formValues.endsOn?.trim() ? formValues.endsOn : null;
    })(),
    description: formValues.description?.trim() || null,
    departmentId: formValues.departmentId || null,
    daySchedules: (formValues.daySchedules ?? [])
      .filter((entry) => entry.date && entry.startTime)
      .sort((a, b) => a.date.localeCompare(b.date)),
    monthlyRule:
      formValues.eventType === EventSeriesType.MONTHLY_RECURRING ? formValues.monthlyRule : null,
  });

  return {
    values,
    errors,
    submitCount,
    hasEndDate,
    congregations,
    congregationsStatus,
    departments,
    departmentsStatus,
    daySchedules,
    canApplyFirstScheduleToRange,
    handleSubmit,
    addDaySchedule,
    removeDaySchedule,
    applyFirstScheduleToRange,
    setHasEndDate,
    toPayload,
  };
};
