<script setup lang="ts">
const props = defineProps<{
  initialData?: {
    name: string;
    description?: string | null;
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
});

interface FunctionInput {
  id?: string;
  name: string;
  description?: string | null;
}

const functions = ref<FunctionInput[]>(
  props.initialData?.functions?.map((fn) => ({
    id: fn.id,
    name: fn.name,
    description: fn.description ?? '',
  })) ?? [],
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
        <div class="space-y-2">
          <Label for="name">{{ $t('form.department.name') }}</Label>
          <Input
            id="name"
            v-model="form.name"
            :placeholder="$t('form.department.namePlaceholder')"
            required
          />
        </div>
        <div class="space-y-2">
          <Label for="description">{{ $t('form.department.description') }}</Label>
          <Textarea
            id="description"
            v-model="form.description"
            :placeholder="$t('form.department.descriptionPlaceholder')"
            rows="3"
          />
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
            <div class="space-y-2">
              <Label>{{ $t('form.department.functionName') }}</Label>
              <Input
                v-model="fn.name"
                :placeholder="$t('form.department.functionNamePlaceholder')"
                required
              />
            </div>
            <div class="space-y-2">
              <Label>{{ $t('form.department.functionDescription') }}</Label>
              <Input
                v-model="fn.description"
                :placeholder="$t('form.department.functionDescriptionPlaceholder')"
              />
            </div>
            <div class="flex md:justify-end">
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
