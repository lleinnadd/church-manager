<script setup lang="ts">
import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlertIcon } from 'lucide-vue-next';
import { DepartmentFunctionScope } from '@prisma/client';
import type { DepartmentFormData, DepartmentFormPayload } from '@/types/forms';

const props = defineProps<{
  initialData?: DepartmentFormData;
  loading?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: DepartmentFormPayload];
}>();

const { locale } = useI18n();

const model = useDepartmentFormModel(toRef(props, 'initialData'));

const {
  congregations,
  congregationsStatus,
  values,
  errors,
  submitCount,
  functions,
  localNames,
  hasAvailableCongregation,
  handleSubmit,
  addFunction,
  removeFunction,
  moveFunction,
  addLocalName,
  removeLocalName,
  isCongregationTaken,
  toPayload,
} = model;

const errorList = computed(() => {
  const messages = Object.values(errors.value).filter(Boolean) as string[];
  return [...new Set(messages)];
});

const onSubmit = handleSubmit((formValues) => {
  emit('submit', toPayload(formValues));
});
</script>

<template>
  <form class="space-y-8" @submit.prevent="onSubmit">
    <Alert v-if="submitCount > 0 && errorList.length" variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>{{ $t('validation.title') }}</AlertTitle>
      <AlertDescription>
        <p>{{ $t('validation.description') }}</p>
        <ul class="ml-4 list-disc space-y-1">
          <li v-for="(message, index) in errorList" :key="index">
            {{ message }}
          </li>
        </ul>
      </AlertDescription>
    </Alert>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.department.generalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.department.generalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>{{ $t('form.department.name') }}</FormLabel>
            <FormControl>
              <Input v-bind="componentField" :placeholder="$t('form.department.namePlaceholder')" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="description">
          <FormItem>
            <FormLabel>{{ $t('form.department.description') }}</FormLabel>
            <FormControl>
              <Textarea
                v-bind="componentField"
                :placeholder="$t('form.department.descriptionPlaceholder')"
                rows="3"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ value, handleChange }" name="hasScopeDivision">
          <FormItem class="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p class="text-sm font-medium leading-none">
                {{ $t('form.department.scopeDivisionLabel') }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ $t('form.department.scopeDivisionDescription') }}
              </p>
            </div>
            <FormControl>
              <Switch
                :model-value="Boolean(value)"
                @update:model-value="(nextValue) => handleChange(Boolean(nextValue))"
              />
            </FormControl>
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card v-if="values.hasScopeDivision">
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
            <FormField v-slot="{ field }" :name="`localNames.${index}.congregationId`">
              <FormItem>
                <FormLabel>{{ $t('form.department.localNameCongregation') }}</FormLabel>
                <FormControl>
                  <Select
                    :key="locale"
                    :model-value="field.value"
                    @update:model-value="field.onChange"
                  >
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
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
            <FormField v-slot="{ componentField }" :name="`localNames.${index}.name`">
              <FormItem>
                <FormLabel>{{ $t('form.department.localNameLabel') }}</FormLabel>
                <FormControl>
                  <Input
                    v-bind="componentField"
                    :placeholder="$t('form.department.localNamePlaceholder')"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
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
              values.hasScopeDivision
                ? 'md:grid-cols-[1fr_1fr_1fr_auto]'
                : 'md:grid-cols-[1fr_1fr_auto]',
            ]"
          >
            <FormField v-slot="{ componentField }" :name="`functions.${index}.name`">
              <FormItem>
                <FormLabel>{{ $t('form.department.functionName') }}</FormLabel>
                <FormControl>
                  <Input
                    v-bind="componentField"
                    :placeholder="$t('form.department.functionNamePlaceholder')"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
            <FormField v-slot="{ componentField }" :name="`functions.${index}.description`">
              <FormItem>
                <FormLabel>{{ $t('form.department.functionDescription') }}</FormLabel>
                <FormControl>
                  <Input
                    v-bind="componentField"
                    :placeholder="$t('form.department.functionDescriptionPlaceholder')"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
            <FormField
              v-if="values.hasScopeDivision"
              v-slot="{ field }"
              :name="`functions.${index}.scope`"
            >
              <FormItem>
                <FormLabel>{{ $t('form.department.functionScope') }}</FormLabel>
                <FormControl>
                  <Select :model-value="field.value" @update:model-value="field.onChange">
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
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
            <div class="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                :disabled="index === 0"
                :aria-label="$t('form.department.moveUp')"
                @click="moveFunction(index, 'up')"
              >
                <ArrowUp class="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                :disabled="index === functions.length - 1"
                :aria-label="$t('form.department.moveDown')"
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
      <Button type="submit" :disabled="loading">
        <span v-if="loading">{{ $t('common.saving') }}</span>
        <span v-else>{{ $t('common.save') }}</span>
      </Button>
    </div>
  </form>
</template>
