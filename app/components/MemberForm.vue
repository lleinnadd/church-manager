<script setup lang="ts">
import {
  MemberStatus,
  MaritalStatus,
  DepartmentScope,
  DepartmentFunctionScope,
  type Congregation,
  type Department,
  type DepartmentFunction,
} from '@prisma/client';
import { CalendarIcon, Trash2 } from 'lucide-vue-next';
import { type DateValue, CalendarDate, getLocalTimeZone } from '@internationalized/date';
import type { MemberDepartmentInput, MemberFormData, MemberFormPayload } from '@/types/forms';
import { useCpfMask } from '@/composables/useCpfMask';
import { useRgMask } from '@/composables/useRgMask';
import { usePhoneMask } from '@/composables/usePhoneMask';

const { t, locale } = useI18n();

const props = defineProps<{
  initialData?: MemberFormData;
  loading?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: MemberFormPayload];
}>();

const isClerkManaged = computed(() => Boolean(props.initialData?.clerkUserId));

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

const form = reactive({
  name: props.initialData?.name ?? '',
  congregationId: props.initialData?.congregationId ?? '',
  status:
    props.initialData?.clerkUserId || props.initialData?.status === MemberStatus.ACTIVE
      ? MemberStatus.ACTIVE
      : (props.initialData?.status ?? MemberStatus.ACTIVE),
  dateOfBirth: normalizeDate(props.initialData?.dateOfBirth ?? null),
  ssn: props.initialData?.ssn ?? '',
  nationalId: props.initialData?.nationalId ?? '',
  maritalStatus: props.initialData?.maritalStatus ?? null,
  addressLinePrimary: props.initialData?.addressLinePrimary ?? '',
  district: props.initialData?.district ?? '',
  memberSince: normalizeDate(props.initialData?.memberSince ?? null),
  motherName: props.initialData?.motherName ?? '',
  fatherName: props.initialData?.fatherName ?? '',
  naturality: props.initialData?.naturality ?? '',
  nationality: props.initialData?.nationality ?? 'Brasileira',
  convertionDate: normalizeDate(props.initialData?.convertionDate ?? null),
  phonePrimary: props.initialData?.phonePrimary ?? '',
  phoneSecondary: props.initialData?.phoneSecondary ?? '',
  observations: props.initialData?.observations ?? '',
});

const dateOfBirthValue = ref<DateValue | undefined>(parseDate(props.initialData?.dateOfBirth));
const memberSinceValue = ref<DateValue | undefined>(parseDate(props.initialData?.memberSince));
const convertionDateValue = ref<DateValue | undefined>(
  parseDate(props.initialData?.convertionDate),
);

const {
  masked: maskedSsn,
  unmasked: unmaskedSsn,
  onInput: onSsnInput,
} = useCpfMask(props.initialData?.ssn ?? '');
const {
  masked: maskedNationalId,
  unmasked: unmaskedNationalId,
  onInput: onNationalIdInput,
} = useRgMask(props.initialData?.nationalId ?? '');
const {
  masked: maskedPhonePrimary,
  unmasked: unmaskedPhonePrimary,
  onInput: onPhonePrimaryInput,
} = usePhoneMask(props.initialData?.phonePrimary ?? '');
const {
  masked: maskedPhoneSecondary,
  unmasked: unmaskedPhoneSecondary,
  onInput: onPhoneSecondaryInput,
} = usePhoneMask(props.initialData?.phoneSecondary ?? '');

watchEffect(() => {
  form.ssn = unmaskedSsn.value;
});

watchEffect(() => {
  form.nationalId = unmaskedNationalId.value;
});

watchEffect(() => {
  form.phonePrimary = unmaskedPhonePrimary.value;
});

watchEffect(() => {
  form.phoneSecondary = unmaskedPhoneSecondary.value;
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

const showDepartments = computed(() => form.status === MemberStatus.ACTIVE);

interface MembershipInput {
  departmentId: string;
  scope: DepartmentScope | null;
  functionId?: string | null;
  congregationId?: string | null;
}
const memberships = ref<MembershipInput[]>(
  props.initialData?.departments?.map((d: MemberDepartmentInput) => ({
    departmentId: d.departmentId,
    scope: d.scope,
    functionId: d.functionId ?? d.function?.id ?? null,
    congregationId: d.congregationId ?? undefined,
  })) ?? [],
);

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
  memberships.value.push({
    departmentId: firstDept?.id ?? '',
    scope: initialScope,
    functionId: firstFunction?.id ?? null,
    congregationId: form.congregationId || undefined,
  });
}

function removeMembership(index: number) {
  memberships.value.splice(index, 1);
}

function functionsForMembership(membership: MembershipInput): DepartmentFunction[] {
  const department = departmentsWithFunctions.value.find((d) => d.id === membership.departmentId);
  if (!department) return [];
  return availableFunctionsForScope(department, membership.scope ?? null);
}

function departmentHasScopeDivision(departmentId: string): boolean {
  const department = departmentsWithFunctions.value.find((d) => d.id === departmentId);
  return department?.hasScopeDivision === true;
}

function departmentLabel(
  department: DepartmentWithLocalNames,
  membership: MembershipInput,
): string {
  const effectiveScope =
    membership.scope ?? (department.hasScopeDivision === false ? null : DepartmentScope.GENERAL);

  if (effectiveScope === DepartmentScope.LOCAL) {
    const congregationId = membership.congregationId || form.congregationId;
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
  memberships,
  (current: MembershipInput[]) => {
    for (let i = 0; i < current.length; i += 1) {
      const membership = current[i]!;

      const functions = functionsForMembership(membership);
      const hasSelectedFunction = functions.some((fn) => fn.id === membership.functionId);
      if (!hasSelectedFunction) {
        memberships.value[i]!.functionId = functions[0]?.id ?? null;
      }

      const hasScopeDivision = departmentHasScopeDivision(membership.departmentId);
      if (!hasScopeDivision) {
        memberships.value[i]!.scope = null;
        memberships.value[i]!.congregationId = null;
      } else {
        if (!membership.scope) {
          memberships.value[i]!.scope = DepartmentScope.GENERAL;
        }

        if (memberships.value[i]!.scope === DepartmentScope.LOCAL) {
          memberships.value[i]!.congregationId =
            memberships.value[i]!.congregationId || form.congregationId || undefined;
        } else {
          memberships.value[i]!.congregationId = null;
        }
      }
    }
  },
  { deep: true },
);

function handleSubmit() {
  const dateOfBirth = dateOfBirthValue.value ? dateOfBirthValue.value.toString() : '';
  const memberSince = memberSinceValue.value ? memberSinceValue.value.toString() : '';
  const convertionDate = convertionDateValue.value ? convertionDateValue.value.toString() : '';

  const payload: MemberFormPayload = {
    ...form,
    dateOfBirth: emptyToNull(dateOfBirth),
    ssn: emptyToNull(form.ssn),
    nationalId: emptyToNull(form.nationalId),
    maritalStatus: form.maritalStatus ?? null,
    addressLinePrimary: emptyToNull(form.addressLinePrimary),
    district: emptyToNull(form.district),
    memberSince: emptyToNull(memberSince),
    motherName: emptyToNull(form.motherName),
    fatherName: emptyToNull(form.fatherName),
    naturality: emptyToNull(form.naturality),
    nationality: emptyToNull(form.nationality),
    convertionDate: emptyToNull(convertionDate),
    phonePrimary: emptyToNull(form.phonePrimary),
    phoneSecondary: emptyToNull(form.phoneSecondary),
    observations: emptyToNull(form.observations),
    status: isClerkManaged.value ? MemberStatus.ACTIVE : form.status,
    departments: showDepartments.value
      ? memberships.value.map((m) => ({
          departmentId: m.departmentId,
          scope: departmentHasScopeDivision(m.departmentId) ? m.scope : null,
          functionId: m.functionId || null,
          congregationId:
            departmentHasScopeDivision(m.departmentId) && m.scope === DepartmentScope.LOCAL
              ? m.congregationId || form.congregationId
              : null,
        }))
      : [],
  };

  emit('submit', payload);
}
</script>

<template>
  <form class="space-y-8" @submit.prevent="handleSubmit">
    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.generalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.member.generalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel for="name">{{ $t('form.member.name') }}</FieldLabel>
          <Input
            id="name"
            v-model="form.name"
            :placeholder="$t('form.member.namePlaceholder')"
            :disabled="isClerkManaged"
            required
          />
        </Field>
        <Field>
          <FieldLabel for="congregation">{{ $t('form.member.congregation') }}</FieldLabel>
          <Select v-model="form.congregationId" required>
            <SelectTrigger>
              <SelectValue :placeholder="$t('form.member.congregationPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="c in congregations || []"
                :key="c.id"
                :value="c.id"
                :disabled="congregationsStatus === 'pending'"
              >
                {{ c.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel for="status">{{ $t('form.member.status') }}</FieldLabel>
          <Select v-model="form.status" :disabled="isClerkManaged" required>
            <SelectTrigger>
              <SelectValue :placeholder="$t('form.member.statusPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.personalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.member.personalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel for="dateOfBirth">{{ $t('form.member.dateOfBirth') }}</FieldLabel>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                :class="[
                  'w-full justify-start text-left font-normal',
                  !dateOfBirthValue && 'text-muted-foreground',
                ]"
              >
                <CalendarIcon class="mr-2 size-4" />
                {{
                  dateOfBirthValue
                    ? formatDateDisplay(dateOfBirthValue as DateValue)
                    : $t('common.pickADate')
                }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="dateOfBirthValue as DateValue"
                layout="month-and-year"
                @update:model-value="(v) => (dateOfBirthValue = v as DateValue)"
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field>
          <FieldLabel for="maritalStatus">{{ $t('form.member.maritalStatus') }}</FieldLabel>
          <Select v-model="form.maritalStatus" required>
            <SelectTrigger>
              <SelectValue :placeholder="$t('form.member.maritalStatusPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in maritalStatusOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel for="motherName">{{ $t('form.member.motherName') }}</FieldLabel>
          <Input
            id="motherName"
            v-model="form.motherName"
            :placeholder="$t('form.member.motherNamePlaceholder')"
            required
          />
        </Field>
        <Field>
          <FieldLabel for="fatherName">{{ $t('form.member.fatherName') }}</FieldLabel>
          <Input
            id="fatherName"
            v-model="form.fatherName"
            :placeholder="$t('form.member.fatherNamePlaceholder')"
            required
          />
        </Field>
        <Field>
          <FieldLabel for="naturality">{{ $t('form.member.naturality') }}</FieldLabel>
          <Input
            id="naturality"
            v-model="form.naturality"
            :placeholder="$t('form.member.naturalityPlaceholder')"
            required
          />
        </Field>
        <Field>
          <FieldLabel for="nationality">{{ $t('form.member.nationality') }}</FieldLabel>
          <Input
            id="nationality"
            v-model="form.nationality"
            :placeholder="$t('form.member.nationalityPlaceholder')"
            required
          />
        </Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.documents') }}</CardTitle>
        <CardDescription>{{ $t('form.member.documentsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel for="ssn">{{ $t('form.member.ssn') }}</FieldLabel>
          <Input
            id="ssn"
            :model-value="maskedSsn"
            :placeholder="$t('form.member.ssnPlaceholder')"
            inputmode="numeric"
            maxlength="14"
            required
            @input="onSsnInput"
          />
        </Field>
        <Field>
          <FieldLabel for="nationalId">{{ $t('form.member.nationalId') }}</FieldLabel>
          <Input
            id="nationalId"
            :model-value="maskedNationalId"
            :placeholder="$t('form.member.nationalIdPlaceholder')"
            inputmode="numeric"
            maxlength="12"
            required
            @input="onNationalIdInput"
          />
        </Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.address') }}</CardTitle>
        <CardDescription>{{ $t('form.member.addressDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel for="addressLinePrimary">{{
            $t('form.member.addressLinePrimary')
          }}</FieldLabel>
          <Input
            id="addressLinePrimary"
            v-model="form.addressLinePrimary"
            :placeholder="$t('form.member.addressLinePrimaryPlaceholder')"
            required
          />
        </Field>
        <Field>
          <FieldLabel for="district">{{ $t('form.member.district') }}</FieldLabel>
          <Input
            id="district"
            v-model="form.district"
            :placeholder="$t('form.member.districtPlaceholder')"
            required
          />
        </Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.contact') }}</CardTitle>
        <CardDescription>{{ $t('form.member.contactDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel for="phonePrimary">{{ $t('form.member.phonePrimary') }}</FieldLabel>
          <Input
            id="phonePrimary"
            :model-value="maskedPhonePrimary"
            type="tel"
            :placeholder="$t('form.member.phonePrimaryPlaceholder')"
            inputmode="numeric"
            maxlength="15"
            required
            @input="onPhonePrimaryInput"
          />
        </Field>
        <Field>
          <FieldLabel for="phoneSecondary">{{ $t('form.member.phoneSecondary') }}</FieldLabel>
          <Input
            id="phoneSecondary"
            :model-value="maskedPhoneSecondary"
            type="tel"
            :placeholder="$t('form.member.phoneSecondaryPlaceholder')"
            inputmode="numeric"
            maxlength="15"
            required
            @input="onPhoneSecondaryInput"
          />
        </Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.membershipDates') }}</CardTitle>
        <CardDescription>{{ $t('form.member.membershipDatesDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel for="memberSince">{{ $t('form.member.memberSince') }}</FieldLabel>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                :class="[
                  'w-full justify-start text-left font-normal',
                  !memberSinceValue && 'text-muted-foreground',
                ]"
              >
                <CalendarIcon class="mr-2 size-4" />
                {{
                  memberSinceValue
                    ? formatDateDisplay(memberSinceValue as DateValue)
                    : $t('common.pickADate')
                }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="memberSinceValue as DateValue"
                layout="month-and-year"
                @update:model-value="(v) => (memberSinceValue = v as DateValue)"
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field>
          <FieldLabel for="convertionDate">{{ $t('form.member.convertionDate') }}</FieldLabel>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                :class="[
                  'w-full justify-start text-left font-normal',
                  !convertionDateValue && 'text-muted-foreground',
                ]"
              >
                <CalendarIcon class="mr-2 size-4" />
                {{
                  convertionDateValue
                    ? formatDateDisplay(convertionDateValue as DateValue)
                    : $t('common.pickADate')
                }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="convertionDateValue as DateValue"
                layout="month-and-year"
                @update:model-value="(v) => (convertionDateValue = v as DateValue)"
              />
            </PopoverContent>
          </Popover>
        </Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.observations') }}</CardTitle>
        <CardDescription>{{ $t('form.member.observationsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel for="observations">{{ $t('form.member.observations') }}</FieldLabel>
          <Textarea
            id="observations"
            v-model="form.observations"
            :placeholder="$t('form.member.observationsPlaceholder')"
            rows="4"
            required
          />
        </Field>
      </CardContent>
    </Card>

    <Card v-if="showDepartments">
      <CardHeader>
        <CardTitle>{{ $t('form.member.departments') }}</CardTitle>
        <CardDescription>{{ $t('form.member.departmentsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="departmentsStatus === 'pending'" class="text-sm text-muted-foreground">
          {{ $t('common.loading') }}
        </div>
        <div v-else-if="!departments?.length" class="text-sm text-muted-foreground">
          {{ $t('form.member.noDepartments') }}
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="(membership, index) in memberships"
            :key="index"
            class="grid gap-3 items-end md:grid-cols-[repeat(3,minmax(0,1fr))_36px]"
          >
            <Field>
              <FieldLabel>{{ $t('form.member.department') }}</FieldLabel>
              <Select
                :key="`${membership.departmentId}-${membership.scope ?? 'none'}-${membership.congregationId ?? form.congregationId ?? 'none'}`"
                v-model="membership.departmentId"
                required
              >
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.member.departmentPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="d in departments" :key="d.id" :value="d.id">
                    {{ departmentLabel(d, membership) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{{ $t('form.member.departmentFunction') }}</FieldLabel>
              <Select
                v-model="membership.functionId"
                class="w-full"
                :disabled="!functionsForMembership(membership).length"
                :required="functionsForMembership(membership).length > 0"
              >
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.member.departmentFunctionPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="fn in functionsForMembership(membership)"
                    :key="fn.id"
                    :value="fn.id"
                  >
                    {{ fn.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p
                v-if="!functionsForMembership(membership).length"
                class="text-xs text-muted-foreground"
              >
                {{ $t('form.member.noDepartmentFunctions') }}
              </p>
            </Field>
            <Field v-if="membershipHasScopeDivision(membership)">
              <FieldLabel>{{ $t('form.member.scope') }}</FieldLabel>
              <Select v-model="membership.scope" required>
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.member.scopePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="DepartmentScope.LOCAL">
                    {{ $t('departments.scope.local') }}
                  </SelectItem>
                  <SelectItem :value="DepartmentScope.GENERAL">
                    {{ $t('departments.scope.general') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Button
              variant="ghost"
              size="icon"
              class="col-start-1 justify-self-end md:col-start-4"
              @click="removeMembership(index)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
          <Button type="button" variant="outline" @click="addMembership">
            {{ $t('form.member.addDepartment') }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card v-else>
      <CardHeader>
        <CardTitle>{{ $t('form.member.departments') }}</CardTitle>
        <CardDescription>{{ $t('form.member.departmentsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        {{ $t('form.member.departmentsInactiveHint') }}
      </CardContent>
    </Card>

    <div class="flex items-center gap-3">
      <Button type="button" variant="outline" as-child>
        <NuxtLink to="/members">
          {{ $t('common.back') }}
        </NuxtLink>
      </Button>
      <Button type="submit" :disabled="loading || !form.name || !form.congregationId">
        <span v-if="loading">{{ $t('common.saving') }}</span>
        <span v-else>{{ $t('common.save') }}</span>
      </Button>
    </div>
  </form>
</template>
