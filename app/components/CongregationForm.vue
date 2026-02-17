<script setup lang="ts">
import { ArrowLeft, CalendarIcon } from 'lucide-vue-next';
import { type DateValue, CalendarDate, getLocalTimeZone } from '@internationalized/date';
import { BRAZIL_STATES } from '@/lib/constants';
import type { CongregationFormPayload } from '@/types/forms';

const { t, locale } = useI18n();

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

const emit = defineEmits<{
  submit: [data: CongregationFormPayload];
}>();

function parseDate(value: string | null | undefined): DateValue | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

const sinceDate = ref<DateValue | undefined>(parseDate(props.initialData?.since));

const {
  masked: maskedZipCode,
  unmasked: unmaskedZipCode,
  onInput: onZipCodeInput,
} = useZipCodeMask(props.initialData?.zipCode ?? '');

const form = ref({
  name: props.initialData?.name ?? '',
  type: props.initialData?.type ?? 'HEADQUARTERS',
  zipCode: props.initialData?.zipCode ?? '',
  addressLinePrimary: props.initialData?.addressLinePrimary ?? '',
  addressLineSecondary: props.initialData?.addressLineSecondary ?? '',
  district: props.initialData?.district ?? '',
  city: props.initialData?.city ?? '',
  state: props.initialData?.state ?? '',
});

const congregationTypes = computed(() => [
  { value: 'HEADQUARTERS', label: t('form.congregation.type.headquarters') },
  { value: 'BRANCH', label: t('form.congregation.type.branch') },
  { value: 'SUB_BRANCH', label: t('form.congregation.type.subBranch') },
]);

function formatDateDisplay(date: DateValue | undefined) {
  if (!date) return '';
  return date.toDate(getLocalTimeZone()).toLocaleDateString(locale.value);
}

function handleSubmit() {
  const since = sinceDate.value ? sinceDate.value.toDate(getLocalTimeZone()).toISOString() : '';
  emit('submit', { ...form.value, zipCode: unmaskedZipCode.value, since });
}
</script>

<template>
  <form class="space-y-8" @submit.prevent="handleSubmit">
    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.congregation.generalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.congregation.generalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel for="name">{{ $t('form.congregation.name') }}</FieldLabel>
          <Input
            id="name"
            v-model="form.name"
            :placeholder="$t('form.congregation.namePlaceholder')"
            required
          />
        </Field>
        <Field>
          <FieldLabel for="type">{{ $t('form.congregation.type.label') }}</FieldLabel>
          <Select v-model="form.type">
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
        </Field>
        <Field>
          <FieldLabel>{{ $t('form.congregation.since') }}</FieldLabel>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                :class="[
                  'w-full justify-start text-left font-normal',
                  !sinceDate && 'text-muted-foreground',
                ]"
              >
                <CalendarIcon class="mr-2 size-4" />
                {{ sinceDate ? formatDateDisplay(sinceDate as DateValue) : $t('common.pickADate') }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="sinceDate as DateValue"
                layout="month-and-year"
                @update:model-value="(v) => (sinceDate = v as DateValue)"
              />
            </PopoverContent>
          </Popover>
        </Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.congregation.address') }}</CardTitle>
        <CardDescription>{{ $t('form.congregation.addressDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel for="zipCode">{{ $t('form.congregation.zipCode') }}</FieldLabel>
          <Input
            id="zipCode"
            :model-value="maskedZipCode"
            :placeholder="$t('form.congregation.zipCodePlaceholder')"
            maxlength="9"
            @input="onZipCodeInput"
          />
        </Field>
        <Field>
          <FieldLabel for="addressLinePrimary">{{
            $t('form.congregation.addressLine')
          }}</FieldLabel>
          <Input
            id="addressLinePrimary"
            v-model="form.addressLinePrimary"
            :placeholder="$t('form.congregation.addressLinePlaceholder')"
          />
        </Field>
        <Field>
          <FieldLabel for="addressLineSecondary">{{
            $t('form.congregation.complement')
          }}</FieldLabel>
          <Input
            id="addressLineSecondary"
            v-model="form.addressLineSecondary"
            :placeholder="$t('form.congregation.complementPlaceholder')"
          />
        </Field>
        <Field>
          <FieldLabel for="district">{{ $t('form.congregation.district') }}</FieldLabel>
          <Input
            id="district"
            v-model="form.district"
            :placeholder="$t('form.congregation.districtPlaceholder')"
          />
        </Field>
        <Field>
          <FieldLabel for="city">{{ $t('form.congregation.city') }}</FieldLabel>
          <Input
            id="city"
            v-model="form.city"
            :placeholder="$t('form.congregation.cityPlaceholder')"
          />
        </Field>
        <Field>
          <FieldLabel for="state">{{ $t('form.congregation.state') }}</FieldLabel>
          <Select v-model="form.state">
            <SelectTrigger>
              <SelectValue :placeholder="$t('form.congregation.statePlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="state in BRAZIL_STATES" :key="state.value" :value="state.value">
                {{ state.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>

    <div class="flex items-center gap-3">
      <Button type="button" variant="outline" as-child>
        <NuxtLink to="/congregations">
          <ArrowLeft class="mr-2 size-4" />
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
