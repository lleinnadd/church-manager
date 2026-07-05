<script setup lang="ts">
import { Plus, Trash2, Link } from '@lucide/vue';

export interface PendingBinding {
  functionId: string;
  scope: 'LOCAL' | 'GENERAL';
  label: string;
}

const model = defineModel<PendingBinding[]>({ default: () => [] });

const { t } = useI18n();

interface DepartmentWithFunctions {
  id: string;
  name: string;
  functions: { id: string; name: string }[];
}

const { data: departments } = useFetch<DepartmentWithFunctions[]>('/api/departments');

const departmentsWithFunctions = computed(() =>
  (departments.value ?? []).filter((dept) => (dept.functions ?? []).length > 0),
);

const functionLabels = computed(() => {
  const map = new Map<string, string>();
  (departments.value ?? []).forEach((dept) => {
    (dept.functions ?? []).forEach((fn) => {
      map.set(fn.id, `${dept.name} — ${fn.name}`);
    });
  });
  return map;
});

const checkedFunctionIds = ref<string[]>([]);
const scope = ref<'LOCAL' | 'GENERAL' | ''>('');

function toggleFunction(functionId: string, checked: boolean) {
  if (checked) {
    if (!checkedFunctionIds.value.includes(functionId)) {
      checkedFunctionIds.value = [...checkedFunctionIds.value, functionId];
    }
  } else {
    checkedFunctionIds.value = checkedFunctionIds.value.filter((id) => id !== functionId);
  }
}

function isInModel(functionId: string, scopeValue: string) {
  return model.value.some((b) => b.functionId === functionId && b.scope === scopeValue);
}

function addSelected() {
  if (!scope.value || !checkedFunctionIds.value.length) return;
  const scopeValue = scope.value;
  const additions: PendingBinding[] = checkedFunctionIds.value
    .filter((functionId) => !isInModel(functionId, scopeValue))
    .map((functionId) => ({
      functionId,
      scope: scopeValue,
      label: functionLabels.value.get(functionId) ?? functionId,
    }));

  if (additions.length) {
    model.value = [...model.value, ...additions];
  }
  checkedFunctionIds.value = [];
}

function removePending(index: number) {
  model.value = model.value.filter((_, i) => i !== index);
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="model.length" class="space-y-2">
      <div
        v-for="(binding, index) in model"
        :key="`${binding.functionId}:${binding.scope}`"
        class="flex items-center justify-between rounded-lg border p-3"
      >
        <div class="flex items-center gap-2">
          <Link class="size-4 text-muted-foreground" />
          <span class="font-medium">{{ binding.label }}</span>
          <Badge variant="outline">{{ binding.scope }}</Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-8 text-destructive"
          @click="removePending(index)"
        >
          <Trash2 class="size-4" />
        </Button>
      </div>
    </div>

    <div class="rounded-lg border">
      <div class="border-b p-3">
        <Label>{{ $t('rbac.selectFunctions') }}</Label>
      </div>
      <div class="max-h-64 space-y-4 overflow-y-auto p-3">
        <p v-if="!departmentsWithFunctions.length" class="text-sm text-muted-foreground">
          {{ $t('rbac.noFunctions') }}
        </p>
        <div v-for="dept in departmentsWithFunctions" :key="dept.id" class="space-y-2">
          <p class="text-xs font-semibold uppercase text-muted-foreground">{{ dept.name }}</p>
          <div class="space-y-1 pl-1">
            <label
              v-for="fn in dept.functions"
              :key="fn.id"
              class="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                :checked="checkedFunctionIds.includes(fn.id)"
                @update:checked="(val: boolean) => toggleFunction(fn.id, val)"
              />
              <span>{{ fn.name }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-end gap-2">
      <div class="w-48">
        <Label>{{ $t('rbac.scope') }}</Label>
        <Select v-model="scope">
          <SelectTrigger>
            <SelectValue :placeholder="$t('rbac.selectScope')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOCAL">LOCAL</SelectItem>
            <SelectItem value="GENERAL">GENERAL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="button" :disabled="!scope || !checkedFunctionIds.length" @click="addSelected">
        <Plus class="mr-2 size-4" />
        {{ t('rbac.addToList', { count: checkedFunctionIds.length }) }}
      </Button>
    </div>
  </div>
</template>
