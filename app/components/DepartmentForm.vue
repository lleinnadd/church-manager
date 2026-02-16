<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';

const props = defineProps<{
  initialData?: {
    name: string;
    description?: string | null;
    hasScopeDivision?: boolean;
    functions?: { id?: string; name: string; description?: string | null }[];
  };
  loading?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: Record<string, any>];
}>();

const form = reactive({
  name: props.initialData?.name ?? '',
  description: props.initialData?.description ?? '',
  hasScopeDivision: props.initialData?.hasScopeDivision ?? true,
});

interface FunctionInput {
  id?: string;
  name: string;
  description: string;
}

const functions = ref<FunctionInput[]>(
  props.initialData?.functions?.map((fn) => ({
    id: fn.id,
    name: fn.name,
    description: fn.description ?? '',
  })) ?? [],
);

watch(
  () => props.initialData,
  (value) => {
    if (!value) return;
    form.name = value.name ?? '';
    form.description = value.description ?? '';
    form.hasScopeDivision = value.hasScopeDivision ?? true;
    functions.value =
      value.functions?.map((fn) => ({
        id: fn.id,
        name: fn.name,
        description: fn.description ?? '',
      })) ?? [];
  },
  { immediate: true, deep: true },
);

function addFunction() {
  functions.value.push({ id: undefined, name: '', description: '' });
}

function removeFunction(index: number) {
  functions.value.splice(index, 1);
}

function handleSubmit() {
  emit('submit', {
    ...form,
    functions: functions.value,
  });
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
            class="grid gap-3 md:grid-cols-3 items-end"
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
            <div class="flex justify-end md:justify-end">
              <Button variant="ghost" size="icon" @click="removeFunction(index)">
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
