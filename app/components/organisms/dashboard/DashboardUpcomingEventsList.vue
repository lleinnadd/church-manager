<script setup lang="ts">
import { CalendarDays } from '@lucide/vue';
import type { DashboardUpcomingEvent } from '~~/shared/types/stats';

defineProps<{
  events: DashboardUpcomingEvent[];
}>();

const { locale } = useI18n();

function formatDay(value: string) {
  return new Date(value).toLocaleDateString(locale.value, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
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
  <Card class="h-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-base">
        <CalendarDays class="size-4" />
        {{ $t('pages.home.upcomingEvents.title') }}
      </CardTitle>
      <CardDescription>{{ $t('pages.home.upcomingEvents.description') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="!events.length" class="text-muted-foreground py-8 text-center text-sm">
        {{ $t('pages.home.upcomingEvents.empty') }}
      </div>
      <ul v-else class="divide-border divide-y">
        <li v-for="event in events" :key="event.id" class="flex items-start gap-3 py-3 first:pt-0">
          <div
            class="bg-primary/10 text-primary flex size-12 shrink-0 flex-col items-center justify-center rounded-md text-xs font-medium leading-tight"
          >
            <span>{{ new Date(event.startAt).getUTCDate() }}</span>
            <span class="text-[10px] uppercase">
              {{ new Date(event.startAt).toLocaleDateString(locale, { month: 'short' }) }}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <NuxtLink to="/events" class="block truncate text-sm font-medium hover:underline">
              {{ event.title }}
            </NuxtLink>
            <div class="text-muted-foreground truncate text-xs">
              {{ formatDay(event.startAt) }} · {{ formatTime(event.startAt) }}
            </div>
            <div class="text-muted-foreground mt-0.5 flex flex-wrap gap-1 text-xs">
              <Badge v-if="event.congregation" variant="secondary" class="text-xs">
                {{ event.congregation.name }}
              </Badge>
              <Badge v-if="event.department" variant="outline" class="text-xs">
                {{ event.department.name }}
              </Badge>
            </div>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
