<script setup lang="ts">
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-vue-next';
import { DepartmentFunctionScope, type Congregation } from '@prisma/client';
import type {
  DepartmentFormPayload,
  DepartmentFunctionInput,
  DepartmentLocalNameInput,
} from '@/types/forms';

const props = defineProps<{
  initialData?: {
    name: string;
    description?: string | null;
    hasScopeDivision?: boolean;
    functions?: {
      id?: string;
      name: string;
      description?: string | null;
      sortOrder?: number;
      scope?: DepartmentFunctionScope | null;
    }[];
    localNames?: {
      id?: string;
      name: string;
      congregationId: string;
      congregation?: { id: string; name: string } | null;
    }[];
  };
  loading?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: DepartmentFormPayload];
}>();

const form = reactive({
  name: props.initialData?.name ?? '',
  description: props.initialData?.description ?? '',
  hasScopeDivision: props.initialData?.hasScopeDivision ?? true,
});

type FunctionInput = DepartmentFunctionInput & { description: string; sortOrder: number };

type LocalNameInput = DepartmentLocalNameInput;

const { data: congregations, status: congregationsStatus } =
  useFetch<Congregation[]>('/api/congregations');

function resolveFunctionScope(
  scope: DepartmentFunctionScope | null | undefined,
  hasScopeDivision: boolean,
) {
  return hasScopeDivision ? (scope ?? DepartmentFunctionScope.BOTH) : null;
}

const functions = ref<FunctionInput[]>(
  props.initialData?.functions
    ?.map((fn, index) => ({
      id: fn.id,
      name: fn.name,
      description: fn.description ?? '',
      scope: resolveFunctionScope(fn.scope, form.hasScopeDivision),
      sortOrder: Number.isFinite(fn.sortOrder) ? Number(fn.sortOrder) : index,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) ?? [],
);

const localNames = ref<LocalNameInput[]>(
  props.initialData?.localNames?.map((entry) => ({
    id: entry.id,
    congregationId: entry.congregationId,
    name: entry.name,
  })) ?? [],
);

const hasAvailableCongregation = computed(() => {
  const options = congregations.value ?? [];
  if (!options.length) return false;
  const used = new Set(localNames.value.map((entry) => entry.congregationId).filter(Boolean));
  return options.some((item) => !used.has(item.id));
});

function normalizeSortOrder() {
  functions.value = functions.value.map((fn, index) => ({
    ...fn,
    sortOrder: index,
  }));
}

watch(
  () => props.initialData,
  (value) => {
    if (!value) return;
    form.name = value.name ?? '';
    form.description = value.description ?? '';
    form.hasScopeDivision = value.hasScopeDivision ?? true;
    functions.value =
      value.functions
        ?.map((fn, index) => ({
          id: fn.id,
          name: fn.name,
          description: fn.description ?? '',
          scope: resolveFunctionScope(fn.scope, form.hasScopeDivision),
          sortOrder: Number.isFinite(fn.sortOrder) ? Number(fn.sortOrder) : index,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) ?? [];
    localNames.value =
      value.localNames?.map((entry) => ({
        id: entry.id,
        congregationId: entry.congregationId,
        name: entry.name,
      })) ?? [];
    normalizeSortOrder();
  },
  { immediate: true, deep: true },
);

watch(
  () => form.hasScopeDivision,
  (hasScopeDivision) => {
    functions.value = functions.value.map((fn) => ({
      ...fn,
      scope: resolveFunctionScope(fn.scope, hasScopeDivision),
    }));
  },
);

function addFunction() {
  functions.value.push({
    id: undefined,
    name: '',
    description: '',
    scope: resolveFunctionScope(null, form.hasScopeDivision),
    sortOrder: functions.value.length,
  });
}

function removeFunction(index: number) {
  functions.value.splice(index, 1);
  normalizeSortOrder();
}

function moveFunction(index: number, direction: 'up' | 'down') {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= functions.value.length) return;
  const current = functions.value[index];
  const target = functions.value[targetIndex];
  if (!current || !target) return;
  functions.value.splice(index, 1, target);
  functions.value.splice(targetIndex, 1, current);
  normalizeSortOrder();
}

function nextAvailableCongregationId(): string {
  const used = new Set(localNames.value.map((entry) => entry.congregationId).filter(Boolean));
  const options = congregations.value ?? [];
  const available = options.find((item) => !used.has(item.id));
  return available?.id ?? options[0]?.id ?? '';
}

function addLocalName() {
  localNames.value.push({
    id: undefined,
    congregationId: nextAvailableCongregationId(),
    name: '',
  });
}

function removeLocalName(index: number) {
  localNames.value.splice(index, 1);
}

function isCongregationTaken(congregationId: string, index: number): boolean {
  if (!congregationId) return false;
  return localNames.value.some(
    (entry, idx) => idx !== index && entry.congregationId === congregationId,
  );
}

function handleSubmit() {
  const payload: DepartmentFormPayload = {
    ...form,
    functions: functions.value.map((fn, index) => ({
      ...fn,
      scope: resolveFunctionScope(fn.scope, form.hasScopeDivision),
      sortOrder: index,
    })),
    localNames: localNames.value
      .filter((entry) => entry.congregationId && entry.name.trim())
      .map((entry) => ({
        id: entry.id,
        congregationId: entry.congregationId,
        name: entry.name.trim(),
      })),
  };

  emit('submit', payload);
}
</script>

<template>
  <form class="space-y-8" @submit.prevent="handleSubmit">
    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.department.generalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.department.generalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <Field>
          <FieldLabel for="name">{{ $t('form.department.name') }}</FieldLabel>
          <Input
            id="name"
            v-model="form.name"
            :placeholder="$t('form.department.namePlaceholder')"
            required
          />
        </Field>
        <Field>
          <FieldLabel for="description">{{ $t('form.department.description') }}</FieldLabel>
          <Textarea
            id="description"
            v-model="form.description"
            :placeholder="$t('form.department.descriptionPlaceholder')"
            rows="3"
          />
        </Field>
        <div class="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p class="text-sm font-medium leading-none">
              {{ $t('form.department.scopeDivisionLabel') }}
            </p>
            <p class="text-sm text-muted-foreground">
              {{ $t('form.department.scopeDivisionDescription') }}
            </p>
          </div>
          <Switch v-model="form.hasScopeDivision" />
        </div>
      </CardContent>
    </Card>

    <Card v-if="form.hasScopeDivision">
      <CardHeader>
        <CardTitle>{{ $t('form.department.localNamesTitle') }}</CardTitle>
        <CardDescription>{{ $t('form.department.localNamesDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="congregationsStatus === 'pending'" class="text-sm text-muted-foreground">
          {{ $t('common.loading') }}
        </div>
        <div v-else-if="!congregations?.length" class="text-sm text-muted-foreground">
          {{ $t('form.department.localNamesNoCongregations') }}
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="(entry, index) in localNames"
            :key="entry.id || index"
            class="grid gap-3 items-end md:grid-cols-[1fr_1fr_auto]"
          >
            <Field>
              <FieldLabel>{{ $t('form.department.localNameCongregation') }}</FieldLabel>
              <Select v-model="entry.congregationId">
                <SelectTrigger>
                  <SelectValue
                    :placeholder="$t('form.department.localNameCongregationPlaceholder')"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="c in congregations || []"
                    :key="c.id"
                    :value="c.id"
                    :disabled="isCongregationTaken(c.id, index)"
                  >
                    {{ c.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{{ $t('form.department.localNameLabel') }}</FieldLabel>
              <Input
                v-model="entry.name"
                :placeholder="$t('form.department.localNamePlaceholder')"
              />
            </Field>
            <div class="flex items-center justify-end">
              <Button type="button" variant="ghost" size="icon" @click="removeLocalName(index)">
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            :disabled="!hasAvailableCongregation"
            @click="addLocalName"
          >
            <Plus class="mr-2 size-4" />
            {{ $t('form.department.addLocalName') }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.department.functions') }}</CardTitle>
        <CardDescription>{{ $t('form.department.functionsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="!functions.length" class="text-sm text-muted-foreground">
          {{ $t('form.department.noFunctions') }}
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="(fn, index) in functions"
            :key="fn.id || index"
            :class="[
              'grid gap-3 items-end',
              form.hasScopeDivision
                ? 'md:grid-cols-[1fr_1fr_1fr_auto]'
                : 'md:grid-cols-[1fr_1fr_auto]',
            ]"
          >
            <Field>
              <FieldLabel>{{ $t('form.department.functionName') }}</FieldLabel>
              <Input
                v-model="fn.name"
                :placeholder="$t('form.department.functionNamePlaceholder')"
                required
              />
            </Field>
            <Field>
              <FieldLabel>{{ $t('form.department.functionDescription') }}</FieldLabel>
              <Input
                v-model="fn.description"
                :placeholder="$t('form.department.functionDescriptionPlaceholder')"
              />
            </Field>
            <Field v-if="form.hasScopeDivision">
              <FieldLabel>{{ $t('form.department.functionScope') }}</FieldLabel>
              <Select v-model="fn.scope">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.department.functionScopePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="DepartmentFunctionScope.BOTH">
                    {{ $t('departments.scope.both') }}
                  </SelectItem>
                  <SelectItem :value="DepartmentFunctionScope.LOCAL">
                    {{ $t('departments.scope.local') }}
                  </SelectItem>
                  <SelectItem :value="DepartmentFunctionScope.GENERAL">
                    {{ $t('departments.scope.general') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div class="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                :disabled="index === 0"
                aria-label="Mover acima"
                @click="moveFunction(index, 'up')"
              >
                <ArrowUp class="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                :disabled="index === functions.length - 1"
                aria-label="Mover abaixo"
                @click="moveFunction(index, 'down')"
              >
                <ArrowDown class="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" @click="removeFunction(index)">
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" @click="addFunction">
          {{ $t('form.department.addFunction') }}
        </Button>
      </CardContent>
    </Card>

    <div class="flex items-center gap-3">
      <Button type="button" variant="outline" as-child>
        <NuxtLink to="/departments">
          {{ $t('common.back') }}
        </NuxtLink>
      </Button>
      <Button type="submit" :disabled="loading || !form.name">
        <span v-if="loading">{{ $t('common.saving') }}</span>
        <span v-else>{{ $t('common.save') }}</span>
      </Button>
    </div>
  </form>
</template>
