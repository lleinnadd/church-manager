<script setup lang="ts">
import { CalendarRange } from '@lucide/vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import enLocale from '@fullcalendar/core/locales/en-gb';
import type { CalendarOptions, EventInput } from '@fullcalendar/core';
import type { DashboardUpcomingEvent } from '~~/shared/types/stats';

const props = defineProps<{
  events: DashboardUpcomingEvent[];
}>();

const { t, locale } = useI18n();

function getCalendarLocale() {
  return locale.value === 'pt-BR' ? ptBrLocale : enLocale;
}

function getEventTypeStyles(eventType: string) {
  if (eventType === 'MONTHLY_RECURRING') {
    return {
      dot: 'var(--chart-2)',
      border: 'var(--chart-2)',
      bg: 'color-mix(in oklab, var(--chart-2) 18%, transparent)',
      bgHover: 'color-mix(in oklab, var(--chart-2) 26%, transparent)',
    };
  }
  if (eventType === 'MULTI_DAY') {
    return {
      dot: 'var(--chart-1)',
      border: 'var(--chart-1)',
      bg: 'color-mix(in oklab, var(--chart-1) 18%, transparent)',
      bgHover: 'color-mix(in oklab, var(--chart-1) 26%, transparent)',
    };
  }
  return {
    dot: 'var(--chart-5)',
    border: 'var(--chart-5)',
    bg: 'color-mix(in oklab, var(--chart-5) 18%, transparent)',
    bgHover: 'color-mix(in oklab, var(--chart-5) 26%, transparent)',
  };
}

function buildDayHeaderLabel(date: Date) {
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const dayKey = dayKeys[date.getUTCDay()];
  return t(`pages.events.weekdaysShort.${dayKey}`);
}

const calendarEvents = computed<EventInput[]>(() =>
  props.events.map((evt) => ({
    id: evt.id,
    title: evt.title,
    start: evt.startAt,
    end: evt.endAt,
    extendedProps: {
      eventType: evt.eventType,
      congregationName: evt.congregation?.name ?? null,
      departmentName: evt.department?.name ?? null,
    },
  })),
);

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin],
  initialView: 'dayGridMonth',
  fixedWeekCount: false,
  showNonCurrentDates: true,
  locale: getCalendarLocale(),
  locales: [ptBrLocale, enLocale],
  height: '100%',
  dayMaxEvents: 4,
  editable: false,
  selectable: false,
  eventDisplay: 'block',
  displayEventTime: false,
  eventOrder: 'start',
  timeZone: 'local',
  dayHeaderContent: (arg) => buildDayHeaderLabel(arg.date),
  headerToolbar: {
    left: 'prev,next',
    center: 'title',
    right: 'today',
  },
  buttonText: {
    today: t('common.today'),
  },
  events: calendarEvents.value,
  eventContent: () => ({ html: '<span class="fc-mini-dot"></span>' }),
  eventDidMount: (info) => {
    const eventProps = info.event.extendedProps as {
      eventType?: string;
      congregationName?: string | null;
      departmentName?: string | null;
    };
    const eventType = String(eventProps.eventType || 'SINGLE_DAY');
    const styles = getEventTypeStyles(eventType);
    const el = info.el;
    el.style.setProperty('--event-dot-color', styles.dot);
    el.classList.add('fc-mini-event');

    const time = info.event.start
      ? info.event.start.toLocaleTimeString(locale.value, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
    const tooltip = [
      time ? `${time} — ${info.event.title}` : info.event.title,
      eventProps.congregationName,
      eventProps.departmentName,
    ]
      .filter(Boolean)
      .join(' • ');
    el.title = tooltip;
  },
}));
</script>

<template>
  <Card class="overflow-hidden">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-base">
        <CalendarRange class="size-4" />
        {{ $t('pages.home.miniCalendar.title') }}
      </CardTitle>
      <CardDescription>{{ $t('pages.home.miniCalendar.description') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <ClientOnly>
        <div
          class="fc-shadcn-theme fc-mini-calendar overflow-hidden rounded-lg border bg-card text-card-foreground"
        >
          <FullCalendar :options="calendarOptions" />
        </div>
        <template #fallback>
          <div class="flex h-80 items-center justify-center rounded-lg border bg-card">
            <Spinner class="text-muted-foreground size-5" />
          </div>
        </template>
      </ClientOnly>
    </CardContent>
  </Card>
</template>

<style scoped>
.fc-mini-calendar {
  height: 26rem;
}

:deep(.fc-mini-calendar .fc) {
  height: 100%;
  font-size: 0.75rem;
  color: var(--foreground);
  --fc-border-color: var(--border);
}

:deep(.fc-mini-calendar .fc-theme-standard .fc-scrollgrid),
:deep(.fc-mini-calendar .fc-theme-standard td),
:deep(.fc-mini-calendar .fc-theme-standard th),
:deep(.fc-mini-calendar .fc .fc-scrollgrid-section > *) {
  border-color: var(--fc-border-color);
}

:deep(.fc-mini-calendar .fc-scrollgrid) {
  border-radius: 0.5rem;
  overflow: hidden;
  border: 0;
}

:deep(.fc-mini-calendar .fc .fc-scrollgrid > thead > tr.fc-scrollgrid-section-header > th),
:deep(.fc-mini-calendar .fc .fc-scrollgrid > tbody > tr.fc-scrollgrid-section-body > td) {
  border: none;
}

:deep(.fc-mini-calendar .fc .fc-toolbar.fc-header-toolbar) {
  margin: 0;
  padding: 0.5rem;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
}

:deep(.fc-mini-calendar .fc .fc-toolbar.fc-header-toolbar .fc-toolbar-chunk:first-child) {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  justify-self: start;
  min-height: 1.75rem;
}

:deep(.fc-mini-calendar .fc .fc-toolbar.fc-header-toolbar .fc-toolbar-chunk:nth-child(2)) {
  display: flex;
  align-items: center;
  justify-self: center;
  min-height: 1.75rem;
}

:deep(.fc-mini-calendar .fc .fc-toolbar.fc-header-toolbar .fc-toolbar-chunk:last-child) {
  display: flex;
  align-items: center;
  justify-self: end;
  min-height: 1.75rem;
}

:deep(.fc-mini-calendar .fc .fc-toolbar-title) {
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.75rem;
  margin: 0;
  color: var(--foreground);
  padding: 0 0.5rem;
}

:deep(.fc-mini-calendar .fc .fc-toolbar-title::first-letter) {
  text-transform: uppercase;
}

:deep(.fc-mini-calendar .fc .fc-button) {
  border: 1px solid var(--input);
  background: var(--background);
  color: var(--foreground);
  box-shadow: none;
  border-radius: calc(var(--radius) - 4px);
  padding: 0.35rem 0.625rem;
  font-size: 0.75rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.75rem;
}

:deep(.fc-mini-calendar .fc .fc-button .fc-icon) {
  font-size: 1rem;
  vertical-align: middle;
}

:deep(.fc-mini-calendar .fc .fc-button:hover) {
  background: var(--accent);
  color: var(--accent-foreground);
  border-color: var(--accent);
}

:deep(.fc-mini-calendar .fc .fc-button-primary:not(:disabled).fc-button-active),
:deep(.fc-mini-calendar .fc .fc-button-primary:not(:disabled):active) {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-foreground);
  box-shadow: none;
}

:deep(.fc-mini-calendar .fc .fc-button:focus-visible) {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

:deep(.fc-mini-calendar .fc .fc-daygrid-day-frame) {
  background: color-mix(in oklab, var(--card) 95%, transparent);
  min-height: 3.25rem;
  padding: 0.25rem 0.15rem 0.3rem;
  display: flex;
  flex-direction: column;
}

:deep(.fc-mini-calendar .fc .fc-daygrid-day-top) {
  justify-content: center;
  padding-top: 0;
}

:deep(.fc-mini-calendar .fc .fc-daygrid-day-number) {
  float: none;
  margin-inline: auto;
  text-align: center;
  font-size: 0.75rem;
  color: var(--foreground);
  font-weight: 500;
  padding: 0;
}

:deep(.fc-mini-calendar .fc .fc-col-header-cell-cushion) {
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-size: 0.6rem;
  color: var(--muted-foreground);
  font-weight: 500;
  padding: 0.25rem 0;
}

:deep(.fc-mini-calendar .fc .fc-dayGridMonth-view) {
  border-top: 1px solid var(--fc-border-color);
}

:deep(.fc-mini-calendar .fc .fc-day-today) {
  background: color-mix(in oklab, var(--accent) 14%, transparent);
}

:deep(.fc-mini-calendar .fc .fc-day-other .fc-daygrid-day-number) {
  color: var(--muted-foreground);
  opacity: 0.5;
}

:deep(.fc-mini-calendar .fc .fc-event) {
  background: transparent !important;
  border: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  cursor: default;
  display: inline-flex;
  width: auto !important;
  pointer-events: auto;
}

:deep(.fc-mini-calendar .fc .fc-daygrid-event-harness) {
  display: inline-flex !important;
  width: auto !important;
  margin: 0 !important;
}

:deep(.fc-mini-calendar .fc .fc-daygrid-day-bottom) {
  display: flex;
  justify-content: center;
  padding: 0.1rem 0 0;
}

:deep(.fc-mini-calendar .fc .fc-daygrid-day-events) {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  justify-content: center;
  padding: 0.05rem 0;
}

:deep(.fc-mini-calendar .fc .fc-mini-dot) {
  display: inline-block;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
  background: var(--event-dot-color, var(--chart-1));
  box-shadow: 0 0 0 1.5px color-mix(in oklab, var(--card) 80%, transparent);
}

:deep(.fc-mini-calendar .fc .fc-daygrid-event-dot) {
  display: none;
}

:deep(.fc-mini-calendar .fc .fc-daygrid-more-link) {
  font-size: 0.6rem;
  color: var(--muted-foreground);
  font-weight: 500;
  margin-top: 0.1rem;
  padding: 0;
}
</style>
