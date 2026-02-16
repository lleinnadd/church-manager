<script setup lang="ts">
import {
  MemberStatus,
  DepartmentScope,
  type Congregation,
  type Department,
  type DepartmentFunction,
} from '@prisma/client';
import { Trash2 } from 'lucide-vue-next';

const { t } = useI18n();

const props = defineProps<{
  initialData?: {
    name: string;
    congregationId: string;
    status: MemberStatus;
    clerkUserId?: string | null;
    departments?: MemberDepartmentInput[];
  };
  loading?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: Record<string, any>];
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

const { data: departments, status: departmentsStatus } =
  useFetch<DepartmentWithFunctions[]>('/api/departments');

const departmentsWithFunctions = computed<DepartmentWithFunctions[]>(() => departments.value ?? []);

const statusOptions = computed(() => [
  { value: MemberStatus.ACTIVE, label: t('members.status.active') },
  { value: MemberStatus.TRANSFERRED, label: t('members.status.transferred') },
  { value: MemberStatus.WITHDRAWN, label: t('members.status.withdrawn') },
]);

const showDepartments = computed(() => form.status === MemberStatus.ACTIVE);

interface MembershipInput {
  departmentId: string;
  scope: DepartmentScope;
  functionId?: string | null;
  congregationId?: string | null;
}
interface MemberDepartmentInput {
  departmentId: string;
  scope: DepartmentScope;
  functionId?: string | null;
  function?: { id: string; name: string; departmentId: string } | null;
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
  const firstFunction = firstDept?.functions?.[0];
  memberships.value.push({
    departmentId: firstDept?.id ?? '',
    scope: DepartmentScope.LOCAL,
    functionId: firstFunction?.id ?? null,
    congregationId: form.congregationId || undefined,
  });
}

function removeMembership(index: number) {
  memberships.value.splice(index, 1);
}

function functionsByDepartment(departmentId: string): DepartmentFunction[] {
  return departmentsWithFunctions.value.find((d) => d.id === departmentId)?.functions ?? [];
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
    }
  },
  { deep: true },
);

function handleSubmit() {
  const payload = {
    ...form,
    status: isClerkManaged.value ? MemberStatus.ACTIVE : form.status,
    departments: showDepartments.value
      ? memberships.value.map((m) => ({
          departmentId: m.departmentId,
          scope: m.scope,
          functionId: m.functionId || null,
          congregationId:
            m.scope === DepartmentScope.LOCAL ? m.congregationId || form.congregationId : null,
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
        <div class="space-y-2">
          <Label for="name">{{ $t('form.member.name') }}</Label>
          <Input
            id="name"
            v-model="form.name"
            :placeholder="$t('form.member.namePlaceholder')"
            :disabled="isClerkManaged"
            required
          />
        </div>
        <div class="space-y-2">
          <Label for="congregation">{{ $t('form.member.congregation') }}</Label>
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
        </div>
        <div class="space-y-2">
          <Label for="status">{{ $t('form.member.status') }}</Label>
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
        </div>
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
            class="grid gap-3 md:grid-cols-3 items-end"
          >
            <div class="space-y-2">
              <Label>{{ $t('form.member.department') }}</Label>
              <Select v-model="membership.departmentId">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.member.departmentPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="d in departments" :key="d.id" :value="d.id">
                    {{ d.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>{{ $t('form.member.scope') }}</Label>
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
            </div>
            <div class="space-y-2">
              <Label>{{ $t('form.member.departmentFunction') }}</Label>
              <div class="flex gap-2">
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
                <Button variant="ghost" size="icon" @click="removeMembership(index)">
                  <Trash2 class="size-4" />
                </Button>
              </div>
              <p
                v-if="!functionsByDepartment(membership.departmentId).length"
                class="text-xs text-muted-foreground"
              >
                {{ $t('form.member.noDepartmentFunctions') }}
              </p>
            </div>
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
