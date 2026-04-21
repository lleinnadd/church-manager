<script setup lang="ts">
import { CalendarClock } from '@lucide/vue';
import type { DashboardUpcomingEvent } from '~~/shared/types/stats';

defineProps<{
  event: DashboardUpcomingEvent | null;
  memberName: string | null;
}>();

const { locale } = useI18n();

function formatFull(value: string) {
  return new Date(value).toLocaleDateString(locale.value, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <Card v-if="event" class="border-primary/30 bg-primary/5">
    <CardContent class="flex items-center gap-4 p-4">
      <div
        class="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-lg"
      >
        <CalendarClock class="size-6" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-muted-foreground text-xs uppercase tracking-wide">
          {{ $t('pages.home.viewerNext.label', { name: memberName ?? '' }) }}
        </div>
        <div class="truncate text-base font-semibold">{{ event.title }}</div>
        <div class="text-muted-foreground text-xs">
          {{ formatFull(event.startAt) }} · {{ formatTime(event.startAt) }}
          <template v-if="event.congregation"> · {{ event.congregation.name }}</template>
        </div>
      </div>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/events">{{ $t('pages.home.viewerNext.cta') }}</NuxtLink>
      </Button>
    </CardContent>
  </Card>
</template>
