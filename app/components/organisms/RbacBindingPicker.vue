<script setup lang="ts">
import { DepartmentFunctionScope, DepartmentScope } from '@prisma/client';
import { Trash2 } from '@lucide/vue';

export interface PendingBinding {
  departmentId: string;
  functionId: string;
  scope: DepartmentScope;
}

const model = defineModel<PendingBinding[]>({ default: () => [] });

const { t } = useI18n();

interface DepartmentFunctionOption {
  id: string;
  name: string;
  scope: DepartmentFunctionScope | null;
  sortOrder: number | null;
}

interface DepartmentWithFunctions {
  id: string;
  name: string;
  hasScopeDivision: boolean;
  functions: DepartmentFunctionOption[];
}

const { data: departments } = useFetch<DepartmentWithFunctions[]>('/api/departments');

const departmentsWithFunctions = computed(() =>
  (departments.value ?? []).filter((dept) => (dept.functions ?? []).length > 0),
);

function availableFunctionsForScope(
  department: DepartmentWithFunctions,
  scope: DepartmentScope,
): DepartmentFunctionOption[] {
  const functions = (department.functions ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

  if (department.hasScopeDivision === false) {
    return functions;
  }

  return functions.filter((fn) => {
    if (!fn.scope || fn.scope === DepartmentFunctionScope.BOTH) return true;
    if (fn.scope === DepartmentFunctionScope.LOCAL) return scope === DepartmentScope.LOCAL;
    if (fn.scope === DepartmentFunctionScope.GENERAL) return scope === DepartmentScope.GENERAL;
    return true;
  });
}

function departmentById(id: string): DepartmentWithFunctions | undefined {
  return departmentsWithFunctions.value.find((d) => d.id === id);
}

function functionsForBinding(binding: PendingBinding): DepartmentFunctionOption[] {
  const dept = departmentById(binding.departmentId);
  if (!dept) return [];
  return availableFunctionsForScope(dept, binding.scope);
}

function bindingHasScopeDivision(binding: PendingBinding): boolean {
  return departmentById(binding.departmentId)?.hasScopeDivision === true;
}

function addBinding() {
  const firstDept = departmentsWithFunctions.value[0];
  if (!firstDept) return;
  const initialScope = DepartmentScope.GENERAL;
  const firstFunction = availableFunctionsForScope(firstDept, initialScope)[0];
  model.value = [
    ...model.value,
    {
      departmentId: firstDept.id,
      functionId: firstFunction?.id ?? '',
      scope: initialScope,
    },
  ];
}

function removeBinding(index: number) {
  model.value = model.value.filter((_, i) => i !== index);
}

function updateBinding(index: number, patch: Partial<PendingBinding>) {
  const next = [...model.value];
  const current = next[index];
  if (!current) return;
  next[index] = { ...current, ...patch };
  model.value = next;
}

watch(
  model,
  (current) => {
    if (!current?.length || !departmentsWithFunctions.value.length) return;
    let changed = false;
    const next = current.map((binding) => {
      const updated: PendingBinding = { ...binding };
      const dept = departmentById(updated.departmentId);
      if (!dept) return updated;

      if (dept.hasScopeDivision === false && updated.scope !== DepartmentScope.GENERAL) {
        updated.scope = DepartmentScope.GENERAL;
      }

      const functions = availableFunctionsForScope(dept, updated.scope);
      const hasSelectedFunction = functions.some((fn) => fn.id === updated.functionId);
      if (!hasSelectedFunction) {
        updated.functionId = functions[0]?.id ?? '';
      }

      if (
        updated.departmentId !== binding.departmentId ||
        updated.scope !== binding.scope ||
        updated.functionId !== binding.functionId
      ) {
        changed = true;
      }
      return updated;
    });
    if (changed) model.value = next;
  },
  { deep: true },
);
</script>

<template>
  <div class="space-y-4">
    <p v-if="!departmentsWithFunctions.length" class="text-sm text-muted-foreground">
      {{ $t('rbac.noFunctions') }}
    </p>

    <div v-else class="space-y-4">
      <div
        v-for="(binding, index) in model"
        :key="index"
        class="grid gap-3 items-end md:grid-cols-[repeat(3,minmax(0,1fr))_36px]"
      >
        <div class="space-y-2">
          <Label>{{ t('rbac.department') }}</Label>
          <Select
            :model-value="binding.departmentId"
            @update:model-value="
              (val: unknown) => updateBinding(index, { departmentId: val as string })
            "
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="d in departmentsWithFunctions" :key="d.id" :value="d.id">
                {{ d.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label>{{ t('rbac.function') }}</Label>
          <Select
            :model-value="binding.functionId"
            :disabled="!functionsForBinding(binding).length"
            @update:model-value="
              (val: unknown) => updateBinding(index, { functionId: val as string })
            "
          >
            <SelectTrigger>
              <SelectValue :placeholder="t('rbac.selectFunction')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="fn in functionsForBinding(binding)" :key="fn.id" :value="fn.id">
                {{ fn.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="bindingHasScopeDivision(binding)" class="space-y-2">
          <Label>{{ t('rbac.scope') }}</Label>
          <Select
            :model-value="binding.scope"
            @update:model-value="
              (val: unknown) => updateBinding(index, { scope: val as DepartmentScope })
            "
          >
            <SelectTrigger>
              <SelectValue />
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
        <div v-else class="hidden md:block" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="col-start-1 justify-self-end md:col-start-4"
          @click="removeBinding(index)"
        >
          <Trash2 class="size-4" />
        </Button>
      </div>

      <Button type="button" variant="outline" @click="addBinding">
        {{ $t('rbac.addBinding') }}
      </Button>
    </div>
  </div>
</template>
