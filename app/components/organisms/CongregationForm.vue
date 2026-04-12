<script setup lang="ts">
import { ArrowLeft, CalendarIcon, TriangleAlertIcon } from '@lucide/vue';
import type { DateValue } from '@internationalized/date';
import { BRAZIL_STATES } from '@/lib/constants';
import type { CongregationFormPayload } from '@/types/forms';

const props = defineProps<{
  initialData?: {
    name: string;
    type: string;
    since: string | null;
    zipCode: string | null;
    addressLinePrimary: string | null;
    addressLineSecondary: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
  };
  loading?: boolean;
}>();

const { locale } = useI18n();

const emit = defineEmits<{
  submit: [data: CongregationFormPayload];
}>();

const model = useCongregationFormModel(toRef(props, 'initialData'));

const {
  sinceDate,
  maskedZipCode,
  onZipCodeInput,
  congregationTypes,
  formatDateDisplay,
  errors,
  submitCount,
  handleSubmit,
  toPayload,
} = model;

const errorList = computed(() => {
  const messages = Object.values(errors.value).filter(Boolean);
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
        <CardTitle>{{ $t('form.congregation.generalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.congregation.generalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.name') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.congregation.namePlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ field }" name="type">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.type.label') }}</FormLabel>
            <FormControl>
              <Select :key="locale" :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.congregation.type.placeholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in congregationTypes"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ field }" name="since">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.since') }}</FormLabel>
            <Popover>
              <FormControl>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="[
                      'w-full justify-start text-left font-normal',
                      !sinceDate && 'text-muted-foreground',
                    ]"
                    @blur="field.onBlur"
                  >
                    <CalendarIcon class="mr-2 size-4" />
                    {{
                      sinceDate ? formatDateDisplay(sinceDate as DateValue) : $t('common.pickADate')
                    }}
                  </Button>
                </PopoverTrigger>
              </FormControl>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="sinceDate as DateValue"
                  layout="month-and-year"
                  @update:model-value="(v) => (sinceDate = v as DateValue)"
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.congregation.address') }}</CardTitle>
        <CardDescription>{{ $t('form.congregation.addressDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ field }" name="zipCode">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.zipCode') }}</FormLabel>
            <FormControl>
              <Input
                :model-value="maskedZipCode"
                :placeholder="$t('form.congregation.zipCodePlaceholder')"
                maxlength="9"
                @input="onZipCodeInput"
                @blur="field.onBlur"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="addressLinePrimary">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.addressLine') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.congregation.addressLinePlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="addressLineSecondary">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.complement') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.congregation.complementPlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="district">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.district') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.congregation.districtPlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="city">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.city') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.congregation.cityPlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ field }" name="state">
          <FormItem>
            <FormLabel>{{ $t('form.congregation.state') }}</FormLabel>
            <FormControl>
              <Select :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.congregation.statePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="state in BRAZIL_STATES"
                    :key="state.value"
                    :value="state.value"
                  >
                    {{ state.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <div class="flex items-center gap-3">
      <Button type="button" variant="outline" as-child>
        <NuxtLink to="/congregations">
          <ArrowLeft class="mr-2 size-4" />
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
