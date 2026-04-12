<script setup lang="ts">
import { EventSeriesType } from '@prisma/client';
import { CalendarIcon, Clock3, Plus, Trash2, TriangleAlertIcon } from '@lucide/vue';
import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
import type { EventFormData, EventFormPayload } from '@/types/forms';

const props = defineProps<{
  initialData?: EventFormData;
  loading?: boolean;
  hideBackButton?: boolean;
}>();

const { locale, t } = useI18n();

const emit = defineEmits<{
  submit: [data: EventFormPayload];
  preview: [data: { title: string; eventType: string; sameTimeStart: string | null }];
}>();

const model = useEventFormModel(toRef(props, 'initialData'));

const {
  values,
  errors,
  submitCount,
  hasEndDate,
  congregations,
  congregationsStatus,
  departments,
  departmentsStatus,
  daySchedules,
  canApplyFirstScheduleToRange,
  handleSubmit,
  addDaySchedule,
  removeDaySchedule,
  applyFirstScheduleToRange,
  setHasEndDate,
  toPayload,
} = model;

const errorList = computed(() => {
  const messages = Object.values(errors.value).filter(Boolean) as string[];
  return [...new Set(messages)];
});

const weekdayOptions = computed(() => [
  { label: t('form.event.weekdayOptions.sunday'), value: 0 },
  { label: t('form.event.weekdayOptions.monday'), value: 1 },
  { label: t('form.event.weekdayOptions.tuesday'), value: 2 },
  { label: t('form.event.weekdayOptions.wednesday'), value: 3 },
  { label: t('form.event.weekdayOptions.thursday'), value: 4 },
  { label: t('form.event.weekdayOptions.friday'), value: 5 },
  { label: t('form.event.weekdayOptions.saturday'), value: 6 },
]);

const ordinalOptions = computed(() => [
  { label: t('form.event.ordinalOptions.firstWeek'), value: 1 },
  { label: t('form.event.ordinalOptions.secondWeek'), value: 2 },
  { label: t('form.event.ordinalOptions.thirdWeek'), value: 3 },
  { label: t('form.event.ordinalOptions.fourthWeek'), value: 4 },
  { label: t('form.event.ordinalOptions.lastWeek'), value: -1 },
]);

const isMonthly = computed(() => values.eventType === EventSeriesType.MONTHLY_RECURRING);
const supportsDaySchedules = computed(() => values.eventType !== EventSeriesType.MONTHLY_RECURRING);
const isSingleDay = computed(() => values.eventType === EventSeriesType.SINGLE_DAY);
const NO_DEPARTMENT_VALUE = '__none__';

const timeOptions = computed(() => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options.push({ value, label: value });
    }
  }
  return options;
});

function parseDateStringToDateValue(value?: string | null): DateValue | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new CalendarDate(year, month, day);
}

function toDateString(value: DateValue | undefined): string {
  if (!value) return '';
  return value.toString();
}

function formatDateDisplay(value: DateValue | undefined): string {
  if (!value) return '';
  return value.toDate(getLocalTimeZone()).toLocaleDateString(locale.value);
}

const onSubmit = handleSubmit((formValues) => {
  emit('submit', toPayload(formValues));
});

watch(
  () => ({ title: values.title, eventType: values.eventType, sameTimeStart: values.sameTimeStart }),
  (val) => {
    emit('preview', {
      title: val.title || '',
      eventType: val.eventType || 'SINGLE_DAY',
      sameTimeStart: val.sameTimeStart || null,
    });
  },
  { immediate: true },
);
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
        <CardTitle>{{ $t('form.event.generalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.event.generalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ componentField }" name="title">
          <FormItem class="md:col-span-2">
            <FormLabel>{{ $t('form.event.title') }}</FormLabel>
            <FormControl>
              <Input v-bind="componentField" :placeholder="$t('form.event.titlePlaceholder')" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="description">
          <FormItem class="md:col-span-2">
            <FormLabel>{{ $t('form.event.description') }}</FormLabel>
            <FormControl>
              <Textarea
                v-bind="componentField"
                rows="3"
                :placeholder="$t('form.event.descriptionPlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ field }" name="congregationId">
          <FormItem>
            <FormLabel>{{ $t('form.event.congregation') }}</FormLabel>
            <FormControl>
              <Select :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.event.congregationPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="congregation in congregations || []"
                    :key="congregation.id"
                    :value="congregation.id"
                  >
                    {{ congregation.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
            <p v-if="congregationsStatus === 'pending'" class="text-xs text-muted-foreground">
              {{ $t('common.loading') }}
            </p>
          </FormItem>
        </FormField>

        <FormField v-slot="{ field }" name="departmentId">
          <FormItem>
            <FormLabel>{{ $t('form.event.department') }}</FormLabel>
            <FormControl>
              <Select
                :model-value="field.value || NO_DEPARTMENT_VALUE"
                @update:model-value="
                  (value) => field.onChange(value === NO_DEPARTMENT_VALUE ? null : value)
                "
              >
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.event.departmentPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NO_DEPARTMENT_VALUE">
                    {{ $t('form.event.noDepartment') }}
                  </SelectItem>
                  <SelectItem
                    v-for="department in departments || []"
                    :key="department.id"
                    :value="department.id"
                  >
                    {{ department.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
            <p v-if="departmentsStatus === 'pending'" class="text-xs text-muted-foreground">
              {{ $t('common.loading') }}
            </p>
          </FormItem>
        </FormField>

        <FormField v-slot="{ field }" name="eventType">
          <FormItem class="md:col-span-2">
            <FormLabel>{{ $t('form.event.type') }}</FormLabel>
            <FormControl>
              <Select :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.event.typePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="EventSeriesType.SINGLE_DAY">
                    {{ $t('form.event.typeSingle') }}
                  </SelectItem>
                  <SelectItem :value="EventSeriesType.MULTI_DAY">
                    {{ $t('form.event.typeMultiDay') }}
                  </SelectItem>
                  <SelectItem :value="EventSeriesType.MONTHLY_RECURRING">
                    {{ $t('form.event.typeMonthly') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ field, meta }" name="startsOn">
          <FormItem>
            <FormLabel>{{ $t('form.event.startsOn') }}</FormLabel>
            <Popover>
              <FormControl>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="[
                      'w-full justify-start text-left font-normal',
                      !field.value && 'text-muted-foreground',
                    ]"
                    :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid"
                    @blur="field.onBlur"
                  >
                    <CalendarIcon class="mr-2 size-4" />
                    {{
                      field.value
                        ? formatDateDisplay(parseDateStringToDateValue(field.value))
                        : $t('common.pickADate')
                    }}
                  </Button>
                </PopoverTrigger>
              </FormControl>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="parseDateStringToDateValue(field.value)"
                  layout="month-and-year"
                  @update:model-value="(v) => field.onChange(toDateString(v as DateValue))"
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
            <div v-if="!isSingleDay" class="mt-2 flex items-center gap-2">
              <Checkbox
                id="has-end-date"
                :model-value="hasEndDate"
                :disabled="values.eventType === EventSeriesType.MULTI_DAY"
                @update:model-value="(checked) => setHasEndDate(checked === true)"
              />
              <Label for="has-end-date">{{ $t('form.event.hasEndDate') }}</Label>
            </div>
          </FormItem>
        </FormField>

        <FormField v-if="!isSingleDay && hasEndDate" v-slot="{ field, meta }" name="endsOn">
          <FormItem>
            <FormLabel>{{ $t('form.event.endsOn') }}</FormLabel>
            <Popover>
              <FormControl>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="[
                      'w-full justify-start text-left font-normal',
                      !field.value && 'text-muted-foreground',
                    ]"
                    :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid"
                    @blur="field.onBlur"
                  >
                    <CalendarIcon class="mr-2 size-4" />
                    {{
                      field.value
                        ? formatDateDisplay(parseDateStringToDateValue(field.value))
                        : $t('common.pickADate')
                    }}
                  </Button>
                </PopoverTrigger>
              </FormControl>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="parseDateStringToDateValue(field.value)"
                  layout="month-and-year"
                  @update:model-value="(v) => field.onChange(toDateString(v as DateValue))"
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>

        <template v-if="supportsDaySchedules">
          <FormField v-slot="{ field, meta }" name="sameTimeStart">
            <FormItem>
              <FormLabel>{{ $t('form.event.sameTimeStart') }}</FormLabel>
              <FormControl>
                <Select :model-value="field.value" @update:model-value="field.onChange">
                  <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                    <div class="flex items-center">
                      <Clock3 class="mr-2 size-4" />
                      <SelectValue :placeholder="$t('common.pickATime')" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in timeOptions"
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
        </template>
      </CardContent>
    </Card>

    <Card v-if="supportsDaySchedules && !isSingleDay">
      <CardHeader>
        <CardTitle>{{ $t('form.event.daySchedules') }}</CardTitle>
        <CardDescription>{{ $t('form.event.daySchedulesDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div v-if="!daySchedules.length" class="text-sm text-muted-foreground">
          {{ $t('form.event.daySchedulesEmpty') }}
        </div>
        <div
          v-for="(entry, index) in daySchedules"
          :key="`${entry.date}-${index}`"
          class="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end"
        >
          <FormField v-slot="{ field, meta }" :name="`daySchedules.${index}.date`">
            <FormItem>
              <FormLabel>{{ $t('form.event.date') }}</FormLabel>
              <Popover>
                <FormControl>
                  <PopoverTrigger as-child>
                    <Button
                      type="button"
                      variant="outline"
                      :class="[
                        'w-full justify-start text-left font-normal',
                        !field.value && 'text-muted-foreground',
                      ]"
                      :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid"
                      @blur="field.onBlur"
                    >
                      <CalendarIcon class="mr-2 size-4" />
                      {{
                        field.value
                          ? formatDateDisplay(parseDateStringToDateValue(field.value))
                          : $t('common.pickADate')
                      }}
                    </Button>
                  </PopoverTrigger>
                </FormControl>
                <PopoverContent class="w-auto p-0">
                  <Calendar
                    :model-value="parseDateStringToDateValue(field.value)"
                    layout="month-and-year"
                    @update:model-value="(v) => field.onChange(toDateString(v as DateValue))"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ field, meta }" :name="`daySchedules.${index}.startTime`">
            <FormItem>
              <FormLabel>{{ $t('form.event.startTime') }}</FormLabel>
              <FormControl>
                <Select :model-value="field.value" @update:model-value="field.onChange">
                  <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                    <div class="flex items-center">
                      <Clock3 class="mr-2 size-4" />
                      <SelectValue :placeholder="$t('common.pickATime')" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in timeOptions"
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
          <Button type="button" variant="ghost" size="icon" @click="removeDaySchedule(index)">
            <Trash2 class="size-4" />
          </Button>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" class="w-full sm:w-auto" @click="addDaySchedule">
            <Plus class="mr-2 size-4" />
            {{ $t('form.event.addDaySchedule') }}
          </Button>
          <Button
            type="button"
            variant="secondary"
            class="w-full sm:w-auto"
            :disabled="!canApplyFirstScheduleToRange"
            @click="applyFirstScheduleToRange"
          >
            {{ $t('form.event.applyFirstScheduleToRange') }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card v-if="isMonthly">
      <CardHeader>
        <CardTitle>{{ $t('form.event.monthlyRule') }}</CardTitle>
        <CardDescription>{{ $t('form.event.monthlyRuleDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ field }" name="monthlyRule.ordinal">
          <FormItem>
            <FormLabel>{{ $t('form.event.ordinal') }}</FormLabel>
            <FormControl>
              <Select :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.event.ordinalPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="item in ordinalOptions" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ field }" name="monthlyRule.weekday">
          <FormItem>
            <FormLabel>{{ $t('form.event.weekday') }}</FormLabel>
            <FormControl>
              <Select :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.event.weekdayPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="item in weekdayOptions" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ field, meta }" name="monthlyRule.startTime">
          <FormItem>
            <FormLabel>{{ $t('form.event.startTime') }}</FormLabel>
            <FormControl>
              <Select :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                  <div class="flex items-center">
                    <Clock3 class="mr-2 size-4" />
                    <SelectValue :placeholder="$t('common.pickATime')" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in timeOptions"
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
      </CardContent>
    </Card>

    <div class="flex items-center gap-3">
      <Button v-if="!hideBackButton" type="button" variant="outline" as-child>
        <NuxtLink to="/events">
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
