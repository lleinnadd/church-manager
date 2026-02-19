import {
  MemberStatus,
  MaritalStatus,
  DepartmentScope,
  DepartmentFunctionScope,
  type Congregation,
  type Department,
  type DepartmentFunction,
} from '@prisma/client';
import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { computed, ref, watch, watchEffect, type Ref } from 'vue';
import type { MemberDepartmentInput, MemberFormData, MemberFormPayload } from '@/types/forms';
import { buildMemberFormSchema } from '@/lib/validation';
import { useCpfMask } from '@/composables/useCpfMask';
import { useRgMask } from '@/composables/useRgMask';
import { usePhoneMask } from '@/composables/usePhoneMask';

interface MembershipInput {
  departmentId: string;
  scope: DepartmentScope | null;
  functionId: string | null;
  congregationId: string | null;
}

function normalizeDate(value?: string | null): string {
  if (!value) {
    return '';
  }
  return value.includes('T') ? value.slice(0, 10) : value;
}

function parseDate(value: string | null | undefined): DateValue | undefined {
  if (!value) return undefined;
  const normalized = normalizeDate(value);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}

export const useMemberFormModel = (initialData: Ref<MemberFormData | undefined>) => {
  const { t, locale } = useI18n();

  const isClerkManaged = computed(() => Boolean(initialData.value?.clerkUserId));

  const buildInitialValues = (data?: MemberFormData): MemberFormPayload => ({
    name: data?.name ?? '',
    congregationId: data?.congregationId ?? '',
    status:
      data?.clerkUserId || data?.status === MemberStatus.ACTIVE
        ? MemberStatus.ACTIVE
        : (data?.status ?? MemberStatus.ACTIVE),
    dateOfBirth: normalizeDate(data?.dateOfBirth ?? null),
    ssn: data?.ssn ?? '',
    nationalId: data?.nationalId ?? '',
    maritalStatus: data?.maritalStatus ?? MaritalStatus.SINGLE,
    addressLinePrimary: data?.addressLinePrimary ?? '',
    district: data?.district ?? '',
    memberSince: normalizeDate(data?.memberSince ?? null),
    motherName: data?.motherName ?? '',
    fatherName: data?.fatherName ?? '',
    naturality: data?.naturality ?? '',
    nationality: data?.nationality ?? 'Brasileira',
    convertionDate: normalizeDate(data?.convertionDate ?? null),
    phonePrimary: data?.phonePrimary ?? '',
    phoneSecondary: data?.phoneSecondary ?? '',
    observations: data?.observations ?? '',
    departments:
      data?.departments?.map((d: MemberDepartmentInput) => ({
        departmentId: d.departmentId,
        scope: d.scope,
        functionId: d.functionId ?? d.function?.id ?? null,
        congregationId: d.congregationId ?? null,
      })) ?? [],
  });

  const validationSchema = computed(() => toTypedSchema(buildMemberFormSchema(t)));

  const { handleSubmit, setFieldValue, values, errors, submitCount, resetForm } =
    useForm<MemberFormPayload>({
      validationSchema,
      initialValues: buildInitialValues(initialData.value),
    });

  const dateOfBirthValue = ref<DateValue | undefined>(parseDate(initialData.value?.dateOfBirth));
  const memberSinceValue = ref<DateValue | undefined>(parseDate(initialData.value?.memberSince));
  const convertionDateValue = ref<DateValue | undefined>(
    parseDate(initialData.value?.convertionDate),
  );

  const {
    masked: maskedSsn,
    unmasked: unmaskedSsn,
    onInput: onSsnInput,
  } = useCpfMask(initialData.value?.ssn ?? '');
  const {
    masked: maskedNationalId,
    unmasked: unmaskedNationalId,
    onInput: onNationalIdInput,
  } = useRgMask(initialData.value?.nationalId ?? '');
  const {
    masked: maskedPhonePrimary,
    unmasked: unmaskedPhonePrimary,
    onInput: onPhonePrimaryInput,
  } = usePhoneMask(initialData.value?.phonePrimary ?? '');
  const {
    masked: maskedPhoneSecondary,
    unmasked: unmaskedPhoneSecondary,
    onInput: onPhoneSecondaryInput,
  } = usePhoneMask(initialData.value?.phoneSecondary ?? '');

  watch(initialData, (data) => {
    resetForm({ values: buildInitialValues(data) });
    dateOfBirthValue.value = parseDate(data?.dateOfBirth ?? null);
    memberSinceValue.value = parseDate(data?.memberSince ?? null);
    convertionDateValue.value = parseDate(data?.convertionDate ?? null);
  });

  watchEffect(() => {
    setFieldValue('ssn', unmaskedSsn.value);
  });

  watchEffect(() => {
    setFieldValue('nationalId', unmaskedNationalId.value);
  });

  watchEffect(() => {
    setFieldValue('phonePrimary', unmaskedPhonePrimary.value);
  });

  watchEffect(() => {
    setFieldValue('phoneSecondary', unmaskedPhoneSecondary.value);
  });

  watch(dateOfBirthValue, (value) => {
    setFieldValue('dateOfBirth', value ? value.toString() : '');
  });

  watch(memberSinceValue, (value) => {
    setFieldValue('memberSince', value ? value.toString() : '');
  });

  watch(convertionDateValue, (value) => {
    setFieldValue('convertionDate', value ? value.toString() : '');
  });

  const { data: congregations, status: congregationsStatus } =
    useFetch<Congregation[]>('/api/congregations');

  type DepartmentWithFunctions = Department & { functions: DepartmentFunction[] };
  interface DepartmentLocalName {
    id: string;
    name: string;
    congregationId: string;
    congregation?: { id: string; name: string } | null;
  }
  type DepartmentWithLocalNames = DepartmentWithFunctions & { localNames?: DepartmentLocalName[] };

  const { data: departments, status: departmentsStatus } =
    useFetch<DepartmentWithLocalNames[]>('/api/departments');

  const departmentsWithFunctions = computed<DepartmentWithLocalNames[]>(
    () => departments.value ?? [],
  );

  const statusOptions = computed(() => [
    { value: MemberStatus.ACTIVE, label: t('members.status.active') },
    { value: MemberStatus.TRANSFERRED, label: t('members.status.transferred') },
    { value: MemberStatus.WITHDRAWN, label: t('members.status.withdrawn') },
  ]);

  const maritalStatusOptions = computed(() => [
    { value: MaritalStatus.SINGLE, label: t('members.maritalStatus.single') },
    { value: MaritalStatus.MARRIED, label: t('members.maritalStatus.married') },
    { value: MaritalStatus.DIVORCED, label: t('members.maritalStatus.divorced') },
    { value: MaritalStatus.WIDOWED, label: t('members.maritalStatus.widowed') },
    { value: MaritalStatus.SEPARATED, label: t('members.maritalStatus.separated') },
  ]);

  const showDepartments = computed(() => values.status === MemberStatus.ACTIVE);

  const memberships = computed(() => values.departments ?? []);

  function availableFunctionsForScope(
    department: DepartmentWithLocalNames,
    scope: DepartmentScope | null,
  ): DepartmentFunction[] {
    const functions = department.functions
      ?.slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

    if (department.hasScopeDivision === false) {
      return functions ?? [];
    }

    const effectiveScope = scope ?? DepartmentScope.GENERAL;

    return (functions ?? []).filter((fn) => {
      if (!fn.scope || fn.scope === DepartmentFunctionScope.BOTH) return true;
      if (fn.scope === DepartmentFunctionScope.LOCAL) {
        return effectiveScope === DepartmentScope.LOCAL;
      }
      if (fn.scope === DepartmentFunctionScope.GENERAL) {
        return effectiveScope === DepartmentScope.GENERAL;
      }
      return true;
    });
  }

  function departmentHasScopeDivision(departmentId: string): boolean {
    const department = departmentsWithFunctions.value.find((d) => d.id === departmentId);
    return department?.hasScopeDivision === true;
  }

  function addMembership() {
    const firstDept = departmentsWithFunctions.value?.[0];
    const initialScope = firstDept?.hasScopeDivision === false ? null : DepartmentScope.GENERAL;
    const firstFunction = firstDept
      ? availableFunctionsForScope(firstDept, initialScope)
          .slice()
          .sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
          )?.[0]
      : undefined;
    const next = [...memberships.value];
    next.push({
      departmentId: firstDept?.id ?? '',
      scope: initialScope,
      functionId: firstFunction?.id ?? null,
      congregationId: values.congregationId || null,
    });
    setFieldValue('departments', next);
  }

  function removeMembership(index: number) {
    const next = [...memberships.value];
    next.splice(index, 1);
    setFieldValue('departments', next);
  }

  function functionsForMembership(membership: MembershipInput): DepartmentFunction[] {
    const department = departmentsWithFunctions.value.find((d) => d.id === membership.departmentId);
    if (!department) return [];
    return availableFunctionsForScope(department, membership.scope ?? null);
  }

  function departmentLabel(
    department: DepartmentWithLocalNames,
    membership: MembershipInput,
  ): string {
    const effectiveScope =
      membership.scope ?? (department.hasScopeDivision === false ? null : DepartmentScope.GENERAL);

    if (effectiveScope === DepartmentScope.LOCAL) {
      const congregationId = membership.congregationId || values.congregationId;
      const localName = department.localNames?.find(
        (entry) => entry.congregationId === congregationId,
      )?.name;
      return localName || department.name;
    }
    return department.name;
  }

  function membershipHasScopeDivision(membership: MembershipInput): boolean {
    return departmentHasScopeDivision(membership.departmentId);
  }

  function formatDateDisplay(date: DateValue | undefined) {
    if (!date) return '';
    return date.toDate(getLocalTimeZone()).toLocaleDateString(locale.value);
  }

  watch(
    () => values.departments,
    (current: MembershipInput[] = []) => {
      if (!current?.length) return;
      let changed = false;
      const next = current.map((membership) => {
        const updated: MembershipInput = { ...membership };

        const functions = functionsForMembership(updated);
        const hasSelectedFunction = functions.some((fn) => fn.id === updated.functionId);
        if (!hasSelectedFunction) {
          updated.functionId = functions[0]?.id ?? null;
        }

        const hasScopeDivision = departmentHasScopeDivision(updated.departmentId);
        if (!hasScopeDivision) {
          updated.scope = null;
          updated.congregationId = null;
        } else {
          if (!updated.scope) {
            updated.scope = DepartmentScope.GENERAL;
          }

          if (updated.scope === DepartmentScope.LOCAL) {
            updated.congregationId = updated.congregationId || values.congregationId || null;
          } else {
            updated.congregationId = null;
          }
        }

        if (
          updated.departmentId !== membership.departmentId ||
          updated.scope !== membership.scope ||
          updated.functionId !== membership.functionId ||
          updated.congregationId !== membership.congregationId
        ) {
          changed = true;
        }

        return updated;
      });

      if (changed) {
        setFieldValue('departments', next);
      }
    },
    { deep: true },
  );

  const toPayload = (formValues: MemberFormPayload): MemberFormPayload => ({
    ...formValues,
    dateOfBirth: emptyToNull(formValues.dateOfBirth) ?? '',
    memberSince: emptyToNull(formValues.memberSince) ?? '',
    convertionDate: emptyToNull(formValues.convertionDate) ?? '',
    ssn: emptyToNull(formValues.ssn) ?? '',
    nationalId: emptyToNull(formValues.nationalId) ?? '',
    maritalStatus: formValues.maritalStatus ?? MaritalStatus.SINGLE,
    addressLinePrimary: emptyToNull(formValues.addressLinePrimary) ?? '',
    district: emptyToNull(formValues.district) ?? '',
    motherName: emptyToNull(formValues.motherName) ?? '',
    fatherName: emptyToNull(formValues.fatherName) ?? '',
    naturality: emptyToNull(formValues.naturality) ?? '',
    nationality: emptyToNull(formValues.nationality) ?? '',
    phonePrimary: emptyToNull(formValues.phonePrimary) ?? '',
    phoneSecondary: emptyToNull(formValues.phoneSecondary) ?? '',
    observations: emptyToNull(formValues.observations) ?? '',
    status: isClerkManaged.value ? MemberStatus.ACTIVE : formValues.status,
    departments:
      formValues.status === MemberStatus.ACTIVE
        ? formValues.departments.map((m) => ({
            departmentId: m.departmentId,
            scope: departmentHasScopeDivision(m.departmentId) ? m.scope : null,
            functionId: m.functionId || null,
            congregationId:
              departmentHasScopeDivision(m.departmentId) && m.scope === DepartmentScope.LOCAL
                ? m.congregationId || formValues.congregationId || null
                : null,
          }))
        : [],
  });

  return {
    isClerkManaged,
    dateOfBirthValue,
    memberSinceValue,
    convertionDateValue,
    maskedSsn,
    maskedNationalId,
    maskedPhonePrimary,
    maskedPhoneSecondary,
    onSsnInput,
    onNationalIdInput,
    onPhonePrimaryInput,
    onPhoneSecondaryInput,
    congregations,
    congregationsStatus,
    departments,
    departmentsStatus,
    statusOptions,
    maritalStatusOptions,
    showDepartments,
    memberships,
    values,
    errors,
    submitCount,
    handleSubmit,
    formatDateDisplay,
    addMembership,
    removeMembership,
    functionsForMembership,
    departmentLabel,
    membershipHasScopeDivision,
    toPayload,
  };
};
