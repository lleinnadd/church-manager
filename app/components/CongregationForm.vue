<script setup lang="ts">
import { ArrowLeft, CalendarIcon } from 'lucide-vue-next';
import { type DateValue, CalendarDate, getLocalTimeZone } from '@internationalized/date';
import { BRAZIL_STATES } from '@/lib/constants';

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
  return date.toDate(getLocalTimeZone()).toLocaleDateString('pt-BR');
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
        <CardTitle>General Information</CardTitle>
        <CardDescription>Basic details about the congregation.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label for="name">Name *</Label>
          <Input id="name" v-model="form.name" placeholder="Congregation name" required />
        </div>
        <div class="space-y-2">
          <Label>Since</Label>
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
                {{ sinceDate ? formatDateDisplay(sinceDate as DateValue) : 'Pick a date' }}
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
        <CardTitle>Address</CardTitle>
        <CardDescription>Location details of the congregation.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label for="zipCode">ZIP Code</Label>
          <Input id="zipCode" v-model="form.zipCode" placeholder="00000-000" />
        </div>
        <div class="space-y-2">
          <Label for="addressLinePrimary">Address</Label>
          <Input
            id="addressLinePrimary"
            v-model="form.addressLinePrimary"
            placeholder="Street, number"
          />
        </div>
        <div class="space-y-2">
          <Label for="addressLineSecondary">Complement</Label>
          <Input
            id="addressLineSecondary"
            v-model="form.addressLineSecondary"
            placeholder="Apartment, suite, etc."
          />
        </div>
        <div class="space-y-2">
          <Label for="district">District</Label>
          <Input id="district" v-model="form.district" placeholder="District / Neighborhood" />
        </div>
        <div class="space-y-2">
          <Label for="city">City</Label>
          <Input id="city" v-model="form.city" placeholder="City" />
        </div>
        <div class="space-y-2">
          <Label for="state">State</Label>
          <Select v-model="form.state">
            <SelectTrigger>
              <SelectValue placeholder="Select a state" />
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
          Back
        </NuxtLink>
      </Button>
      <Button type="submit" :disabled="loading || !form.name">
        <span v-if="loading">Saving...</span>
        <span v-else>Save</span>
      </Button>
    </div>
  </form>
</template>
