<script setup lang="ts">
import { ArrowLeft, CalendarIcon } from 'lucide-vue-next';
import { type DateValue, CalendarDate, getLocalTimeZone } from '@internationalized/date';
import { BRAZIL_STATES } from '@/lib/constants';

const { locale } = useI18n();

const props = defineProps<{
  initialData?: {
    name: string;
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
  submit: [data: Record<string, string>];
}>();

function parseDate(value: string | null | undefined): DateValue | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

const sinceDate = ref<DateValue | undefined>(parseDate(props.initialData?.since));

const form = ref({
  name: props.initialData?.name ?? '',
  zipCode: props.initialData?.zipCode ?? '',
  addressLinePrimary: props.initialData?.addressLinePrimary ?? '',
  addressLineSecondary: props.initialData?.addressLineSecondary ?? '',
  district: props.initialData?.district ?? '',
  city: props.initialData?.city ?? '',
  state: props.initialData?.state ?? '',
});

function formatDateDisplay(date: DateValue | undefined) {
  if (!date) return '';
  return date.toDate(getLocalTimeZone()).toLocaleDateString(locale.value);
}

function handleSubmit() {
  const since = sinceDate.value ? sinceDate.value.toDate(getLocalTimeZone()).toISOString() : '';
  emit('submit', { ...form.value, since });
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
        <div class="space-y-2">
          <Label for="name">{{ $t('form.congregation.name') }}</Label>
          <Input
            id="name"
            v-model="form.name"
            :placeholder="$t('form.congregation.namePlaceholder')"
            required
          />
        </div>
        <div class="space-y-2">
          <Label>{{ $t('form.congregation.since') }}</Label>
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
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.congregation.address') }}</CardTitle>
        <CardDescription>{{ $t('form.congregation.addressDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label for="zipCode">{{ $t('form.congregation.zipCode') }}</Label>
          <Input
            id="zipCode"
            v-model="form.zipCode"
            :placeholder="$t('form.congregation.zipCodePlaceholder')"
          />
        </div>
        <div class="space-y-2">
          <Label for="addressLinePrimary">{{ $t('form.congregation.addressLine') }}</Label>
          <Input
            id="addressLinePrimary"
            v-model="form.addressLinePrimary"
            :placeholder="$t('form.congregation.addressLinePlaceholder')"
          />
        </div>
        <div class="space-y-2">
          <Label for="addressLineSecondary">{{ $t('form.congregation.complement') }}</Label>
          <Input
            id="addressLineSecondary"
            v-model="form.addressLineSecondary"
            :placeholder="$t('form.congregation.complementPlaceholder')"
          />
        </div>
        <div class="space-y-2">
          <Label for="district">{{ $t('form.congregation.district') }}</Label>
          <Input
            id="district"
            v-model="form.district"
            :placeholder="$t('form.congregation.districtPlaceholder')"
          />
        </div>
        <div class="space-y-2">
          <Label for="city">{{ $t('form.congregation.city') }}</Label>
          <Input
            id="city"
            v-model="form.city"
            :placeholder="$t('form.congregation.cityPlaceholder')"
          />
        </div>
        <div class="space-y-2">
          <Label for="state">{{ $t('form.congregation.state') }}</Label>
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
        </div>
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
