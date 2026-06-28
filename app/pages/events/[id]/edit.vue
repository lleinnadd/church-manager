<script setup lang="ts">
import { EventSeriesType } from '@prisma/client';
import { toast } from 'vue-sonner';
import type { EventFormData, EventFormPayload } from '@/types/forms';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'events', action: 'UPDATE' },
});

interface EventSeriesApiResponse {
  id: string;
  title: string;
  description: string | null;
  congregationId: string;
  departmentId: string | null;
  eventType: EventSeriesType;
  startsOn: string;
  endsOn: string | null;
  sameTimeStartMinutes: number | null;
  monthlyWeekday: number | null;
  monthlyOrdinal: number | null;
  rotationCongregationIds: string[];
  rotationStartDate: string | null;
  daySchedules: { date: string; startMinutes: number; endMinutes: number }[];
}

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const loading = ref(false);

const id = route.params.id as string;
const { data: eventSeries, status } = useFetch<EventSeriesApiResponse>(`/api/events/${id}`);

function toDateOnly(value: string) {
  return value?.slice(0, 10);
}

function minutesToTime(value: number | null | undefined) {
  if (value === null || value === undefined) return '';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const initialData = computed<EventFormData | undefined>(() => {
  if (!eventSeries.value) return undefined;

  return {
    id: eventSeries.value.id,
    title: eventSeries.value.title,
    description: eventSeries.value.description,
    congregationId: eventSeries.value.congregationId,
    departmentId: eventSeries.value.departmentId,
    eventType: eventSeries.value.eventType,
    startsOn: toDateOnly(eventSeries.value.startsOn),
    endsOn: eventSeries.value.endsOn ? toDateOnly(eventSeries.value.endsOn) : null,
    sameTimeStart: minutesToTime(eventSeries.value.sameTimeStartMinutes),
    daySchedules: eventSeries.value.daySchedules.map((entry) => ({
      date: toDateOnly(entry.date),
      startTime: minutesToTime(entry.startMinutes),
    })),
    monthlyRule:
      eventSeries.value.eventType === EventSeriesType.MONTHLY_RECURRING
        ? {
            weekday: eventSeries.value.monthlyWeekday ?? 5,
            ordinal: eventSeries.value.monthlyOrdinal ?? 1,
            startTime: minutesToTime(eventSeries.value.sameTimeStartMinutes) || '19:00',
          }
        : null,
    rotationCongregationIds: eventSeries.value.rotationCongregationIds ?? [],
    rotationStartDate: eventSeries.value.rotationStartDate
      ? toDateOnly(eventSeries.value.rotationStartDate)
      : null,
  };
});

const isLoading = computed(() => status.value === 'pending');

async function handleSubmit(data: EventFormPayload) {
  loading.value = true;
  try {
    await $fetch(`/api/events/${id}` as '/api/events/:id', { method: 'PUT', body: data });
    toast.success(t('pages.events.updateSuccess'));
    await router.push('/events');
  } catch {
    toast.error(t('pages.events.updateError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.events.editTitle') }}</h1>
      <p class="text-muted-foreground text-sm">{{ $t('pages.events.editDescription') }}</p>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <Skeleton class="h-40 w-full rounded-xl" />
      <Skeleton class="h-40 w-full rounded-xl" />
    </div>

    <EventForm
      v-else-if="initialData"
      :initial-data="initialData"
      :loading="loading"
      @submit="handleSubmit"
    />
  </div>
</template>
