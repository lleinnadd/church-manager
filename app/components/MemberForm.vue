<script setup lang="ts">
import {
  MemberStatus,
  DepartmentScope,
  type Congregation,
  type Department,
  type DepartmentFunction,
} from '@prisma/client';
import { Trash2 } from 'lucide-vue-next';
import type { MemberDepartmentInput, MemberFormData, MemberFormPayload } from '@/types/forms';

const { t } = useI18n();

const props = defineProps<{
  initialData?: MemberFormData;
  loading?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: MemberFormPayload];
}>();

const isClerkManaged = computed(() => Boolean(props.initialData?.clerkUserId));

const form = reactive({
  name: props.initialData?.name ?? '',
  congregationId: props.initialData?.congregationId ?? '',
  status:
    props.initialData?.clerkUserId || props.initialData?.status === MemberStatus.ACTIVE
      ? MemberStatus.ACTIVE
      : (props.initialData?.status ?? MemberStatus.ACTIVE),
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

function addMembership() {
  const firstDept = departmentsWithFunctions.value?.[0];
  const firstFunction = firstDept?.functions
    ?.slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))?.[0];
  memberships.value.push({
    departmentId: firstDept?.id ?? '',
    scope: firstDept?.hasScopeDivision === false ? null : DepartmentScope.GENERAL,
    functionId: firstFunction?.id ?? null,
    congregationId: form.congregationId || undefined,
  });
}

function removeMembership(index: number) {
  memberships.value.splice(index, 1);
}

function functionsByDepartment(departmentId: string): DepartmentFunction[] {
  return (departmentsWithFunctions.value.find((d) => d.id === departmentId)?.functions ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
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

watch(
  memberships,
  (current: MembershipInput[]) => {
    for (let i = 0; i < current.length; i += 1) {
      const membership = current[i]!;

      const functions = functionsByDepartment(membership.departmentId);
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
  const payload: MemberFormPayload = {
    ...form,
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
          <Select v-model="form.status" :disabled="isClerkManaged">
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
                :disabled="!functionsByDepartment(membership.departmentId).length"
              >
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.member.departmentFunctionPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="fn in functionsByDepartment(membership.departmentId)"
                    :key="fn.id"
                    :value="fn.id"
                  >
                    {{ fn.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p
                v-if="!functionsByDepartment(membership.departmentId).length"
                class="text-xs text-muted-foreground"
              >
                {{ $t('form.member.noDepartmentFunctions') }}
              </p>
            </Field>
            <Field v-if="membershipHasScopeDivision(membership)">
              <FieldLabel>{{ $t('form.member.scope') }}</FieldLabel>
              <Select v-model="membership.scope">
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
