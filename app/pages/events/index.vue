<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import enLocale from '@fullcalendar/core/locales/en-gb';
import type { CalendarOptions, EventInput } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { CalendarMinus, CalendarX2, Pencil, Plus, Trash2, X } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { EventSeriesType } from '@prisma/client';
import type { EventFormData, EventFormPayload } from '@/types/forms';
import { useSidebar } from '@/components/ui/sidebar/utils';

interface EventOccurrence {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  occurrenceDate: string;
  isException?: boolean;
  seriesId: string;
  congregation?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  series: {
    id: string;
    eventType?: string;
    startsOn?: string;
    endsOn?: string | null;
    monthlyWeekday?: number | null;
    monthlyOrdinal?: number | null;
  };
}

interface CalendarExtendedProps {
  seriesId?: string;
  occurrenceDate?: string;
  rawStartAt?: string;
  rawEndAt?: string;
  description?: string | null;
  congregationName?: string;
  departmentName?: string;
  eventType?: string;
  startsOn?: string;
  endsOn?: string | null;
  monthlyWeekday?: number | null;
  monthlyOrdinal?: number | null;
}

interface SelectedCalendarOccurrence {
  id: string;
  seriesId: string;
  title: string;
  description: string | null;
  occurrenceDate: string;
  startAt: string;
  endAt: string;
  congregationName?: string;
  departmentName?: string;
  eventType?: string;
}

interface EventSeriesDetails {
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
  daySchedules: { date: string; startMinutes: number; endMinutes: number }[];
}

type EventActionType = 'delete-occurrence' | 'delete-series' | 'end-recurrence' | null;

const { t, locale } = useI18n();
const { timezone } = useTimezone();
const { open: sidebarOpen, openMobile: sidebarOpenMobile, isMobile } = useSidebar();

const loading = ref(false);
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null);
const calendarContainerRef = ref<HTMLElement | null>(null);
let calendarResizeObserver: ResizeObserver | null = null;
let calendarResizeRafId: number | null = null;
let calendarResizeTimeoutId: number | null = null;

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const actionLoading = ref(false);
const detailsPosition = ref({ x: 0, y: 0 });
const detailsSide = ref<'left' | 'right'>('right');
const selectedOccurrence = ref<SelectedCalendarOccurrence | null>(null);
const selectedSeries = ref<EventSeriesDetails | null>(null);
const confirmAction = ref<EventActionType>(null);
const confirmDialogOpen = ref(false);

const createOpen = ref(false);
const createPosition = ref({ x: 0, y: 0 });
const createSide = ref<'left' | 'right'>('right');
const createInitialDate = ref<string | undefined>();
const createLoading = ref(false);

const PLACEHOLDER_EVENT_ID = '__create_placeholder__';
const createPreview = ref<{ title: string; eventType: string; sameTimeStart: string | null }>({
  title: '',
  eventType: 'SINGLE_DAY',
  sameTimeStart: null,
});

const exportDialogOpen = ref(false);
const exportCurrentMonth = ref('');

function getCurrentCalendarMonth(): string {
  const api = calendarRef.value?.getApi();
  if (!api) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const date = api.getDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function openExportDialog() {
  exportCurrentMonth.value = getCurrentCalendarMonth();
  exportDialogOpen.value = true;
}

const createInitialData = computed<EventFormData | undefined>(() =>
  createInitialDate.value ? ({ startsOn: createInitialDate.value } as EventFormData) : undefined,
);

const POPOVER_VIEWPORT_MARGIN = 12;
const POPOVER_ESTIMATED_WIDTH = 416;

function getCalendarLocale() {
  return locale.value === 'pt-BR' ? ptBrLocale : enLocale;
}

function refetchCalendarEvents() {
  calendarRef.value?.getApi().refetchEvents();
}

function updateCalendarSize() {
  calendarRef.value?.getApi().updateSize();
}

function scheduleCalendarResize() {
  if (!import.meta.client) return;

  if (calendarResizeRafId !== null) {
    window.cancelAnimationFrame(calendarResizeRafId);
  }

  calendarResizeRafId = window.requestAnimationFrame(() => {
    calendarResizeRafId = null;
    updateCalendarSize();
  });

  if (calendarResizeTimeoutId !== null) {
    window.clearTimeout(calendarResizeTimeoutId);
  }

  calendarResizeTimeoutId = window.setTimeout(() => {
    calendarResizeTimeoutId = null;
    updateCalendarSize();
  }, 280);
}

function scheduleCalendarResizeBurst() {
  if (!import.meta.client) return;

  scheduleCalendarResize();

  const followUps = [120, 240, 360];
  followUps.forEach((delay) => {
    window.setTimeout(() => {
      updateCalendarSize();
    }, delay);
  });
}

function closeDetails() {
  detailsOpen.value = false;
  selectedOccurrence.value = null;
  selectedSeries.value = null;
}

function removePlaceholderEvent() {
  const api = calendarRef.value?.getApi();
  if (!api) return;
  const existing = api.getEventById(PLACEHOLDER_EVENT_ID);
  if (existing) existing.remove();
}

function addPlaceholderEvent(dateStr: string) {
  const api = calendarRef.value?.getApi();
  if (!api) return;
  removePlaceholderEvent();

  const preview = createPreview.value;
  const title = preview.title || t('pages.events.new');
  const eventType = preview.eventType || 'SINGLE_DAY';
  const time = preview.sameTimeStart;
  const hasTime = !!time;
  const start = hasTime ? `${dateStr}T${time}:00` : `${dateStr}T00:00:00`;
  const hasTitle = !!preview.title;
  const classNames = ['fc-placeholder-event'];
  if (!hasTime) classNames.push('fc-placeholder-no-time');
  if (hasTitle) classNames.push('fc-placeholder-has-title');
  if (hasTime) classNames.push('fc-placeholder-has-time');

  api.addEvent({
    id: PLACEHOLDER_EVENT_ID,
    title,
    start,
    allDay: false,
    editable: false,
    classNames,
    extendedProps: { eventType },
  });
}

function updatePlaceholderEvent(preview: {
  title: string;
  eventType: string;
  sameTimeStart: string | null;
}) {
  createPreview.value = preview;
  if (!createOpen.value || !createInitialDate.value) return;
  addPlaceholderEvent(createInitialDate.value);
}

function closeCreate() {
  createOpen.value = false;
  createInitialDate.value = undefined;
  createPreview.value = { title: '', eventType: 'SINGLE_DAY', sameTimeStart: null };
  removePlaceholderEvent();
}

watch(createOpen, (open) => {
  if (!open) {
    createInitialDate.value = undefined;
    createPreview.value = { title: '', eventType: 'SINGLE_DAY', sameTimeStart: null };
    removePlaceholderEvent();
  }
});

watch(timezone, () => {
  refetchCalendarEvents();
});

watch(
  [sidebarOpen, sidebarOpenMobile, isMobile],
  () => {
    scheduleCalendarResizeBurst();
  },
  { flush: 'post' },
);

async function handleCreateSubmit(data: EventFormPayload) {
  createLoading.value = true;
  try {
    await $fetch('/api/events', { method: 'POST', body: data });
    toast.success(t('pages.events.createSuccess'));
    closeCreate();
    refetchCalendarEvents();
  } catch {
    toast.error(t('pages.events.createError'));
  } finally {
    createLoading.value = false;
  }
}

function resolveDetailsPlacement({
  clientX,
  clientY,
  eventElement,
}: {
  clientX: number;
  clientY: number;
  eventElement?: HTMLElement;
}) {
  if (!import.meta.client) {
    return {
      position: { x: clientX, y: clientY },
      side: 'right' as const,
    };
  }

  let anchorX = clientX;
  let anchorY = clientY;

  let rightSpace = window.innerWidth - clientX - POPOVER_VIEWPORT_MARGIN;
  let leftSpace = clientX - POPOVER_VIEWPORT_MARGIN;

  if (eventElement) {
    const rect = eventElement.getBoundingClientRect();
    anchorY = rect.top + rect.height / 2;
    rightSpace = window.innerWidth - rect.right - POPOVER_VIEWPORT_MARGIN;
    leftSpace = rect.left - POPOVER_VIEWPORT_MARGIN;
  }

  let side: 'left' | 'right' = rightSpace >= leftSpace ? 'right' : 'left';
  if (side === 'right' && rightSpace < POPOVER_ESTIMATED_WIDTH && leftSpace >= rightSpace) {
    side = 'left';
  }

  if (side === 'left' && leftSpace < POPOVER_ESTIMATED_WIDTH && rightSpace >= leftSpace) {
    side = 'right';
  }

  if (eventElement) {
    const rect = eventElement.getBoundingClientRect();
    anchorX = side === 'right' ? rect.right : rect.left;
  }

  const maxX = window.innerWidth - POPOVER_VIEWPORT_MARGIN;
  const maxY = window.innerHeight - POPOVER_VIEWPORT_MARGIN;
  const x = Math.min(Math.max(anchorX, POPOVER_VIEWPORT_MARGIN), maxX);
  const y = Math.min(Math.max(anchorY, POPOVER_VIEWPORT_MARGIN), maxY);

  return {
    position: { x, y },
    side,
  };
}

function handleEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;

  if (confirmDialogOpen.value) {
    confirmDialogOpen.value = false;
    confirmAction.value = null;
  }

  if (createOpen.value) {
    closeCreate();
  }

  if (detailsOpen.value) {
    closeDetails();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscapeKey);

  if (typeof ResizeObserver !== 'undefined' && calendarContainerRef.value) {
    calendarResizeObserver = new ResizeObserver(() => {
      scheduleCalendarResize();
    });

    calendarResizeObserver.observe(calendarContainerRef.value);
  }

  scheduleCalendarResizeBurst();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscapeKey);

  if (calendarResizeObserver) {
    calendarResizeObserver.disconnect();
    calendarResizeObserver = null;
  }

  if (import.meta.client) {
    if (calendarResizeRafId !== null) {
      window.cancelAnimationFrame(calendarResizeRafId);
      calendarResizeRafId = null;
    }

    if (calendarResizeTimeoutId !== null) {
      window.clearTimeout(calendarResizeTimeoutId);
      calendarResizeTimeoutId = null;
    }
  }
});

function toDateOnly(value?: string | null) {
  return value?.slice(0, 10) || '';
}

function minutesToTime(value: number | null | undefined) {
  if (value === null || value === undefined) return '';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getTimeFromIso(value: string) {
  return new Intl.DateTimeFormat(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone.value,
  }).format(new Date(value));
}

function formatDateLabel(value?: string | null) {
  if (!value) return '-';

  const dateOnly = toDateOnly(value);
  const sourceDate = /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)
    ? new Date(`${dateOnly}T12:00:00.000Z`)
    : new Date(value);

  return sourceDate.toLocaleDateString(locale.value, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: timezone.value,
  });
}

function formatStartTimeLabel(startAt: string) {
  return getTimeFromIso(startAt);
}

function toCalendarWallDateTime(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone.value,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = map.year || '1970';
  const month = map.month || '01';
  const day = map.day || '01';
  const hour = map.hour || '00';
  const minute = map.minute || '00';
  const second = map.second || '00';

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function formatEventTypeLabel(eventType?: string) {
  if (eventType === EventSeriesType.MULTI_DAY) return t('form.event.typeMultiDay');
  if (eventType === EventSeriesType.MONTHLY_RECURRING) return t('form.event.typeMonthly');
  return t('form.event.typeSingle');
}

function formatOrdinalLabel(ordinal: number) {
  if (ordinal === -1) return t('form.event.ordinalOptions.lastWeek');
  if (ordinal === 1) return t('form.event.ordinalOptions.firstWeek');
  if (ordinal === 2) return t('form.event.ordinalOptions.secondWeek');
  if (ordinal === 3) return t('form.event.ordinalOptions.thirdWeek');
  if (ordinal === 4) return t('form.event.ordinalOptions.fourthWeek');
  return '-';
}

function formatWeekdayLabel(weekday: number) {
  const base = new Date(Date.UTC(2023, 0, 1 + weekday, 12, 0, 0));
  return new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    timeZone: timezone.value,
  }).format(base);
}

const recurrenceLabel = computed(() => {
  const occurrence = selectedOccurrence.value;
  if (!occurrence) return '-';

  const series = selectedSeries.value;
  const eventType = series?.eventType || occurrence.eventType;

  if (eventType !== EventSeriesType.MONTHLY_RECURRING) {
    return t('pages.events.notRecurring');
  }

  const weekday = series?.monthlyWeekday;
  const ordinal = series?.monthlyOrdinal;
  if (weekday === null || weekday === undefined || ordinal === null || ordinal === undefined) {
    return t('pages.events.monthlyRecurring');
  }

  return `${formatOrdinalLabel(ordinal)} ${formatWeekdayLabel(weekday)}`;
});

const recurrenceRangeLabel = computed(() => {
  const series = selectedSeries.value;
  if (!series || series.eventType !== EventSeriesType.MONTHLY_RECURRING) return '-';

  const startsOn = formatDateLabel(series.startsOn);
  if (!series.endsOn) {
    return `${startsOn} • ${t('pages.events.noEndDate')}`;
  }

  return `${startsOn} • ${formatDateLabel(series.endsOn)}`;
});

const canEndRecurrence = computed(() => {
  const series = selectedSeries.value;
  const occurrence = selectedOccurrence.value;
  if (!series || !occurrence) return false;
  if (series.eventType !== EventSeriesType.MONTHLY_RECURRING) return false;

  return !series.endsOn;
});

const canDeleteOccurrence = computed(() => {
  const series = selectedSeries.value;
  const occurrence = selectedOccurrence.value;
  if (!occurrence) return false;
  if (!series) return true;

  return series.eventType === EventSeriesType.MONTHLY_RECURRING;
});

const confirmTitle = computed(() => {
  if (confirmAction.value === 'delete-occurrence') return t('pages.events.deleteOccurrenceTitle');
  if (confirmAction.value === 'delete-series') return t('pages.events.deleteSeriesTitle');
  if (confirmAction.value === 'end-recurrence') return t('pages.events.endRecurrenceTitle');
  return '';
});

const confirmDescription = computed(() => {
  if (confirmAction.value === 'delete-occurrence') {
    return t('pages.events.deleteOccurrenceDescription');
  }

  if (confirmAction.value === 'delete-series') {
    return t('pages.events.deleteSeriesDescription', {
      name: selectedOccurrence.value?.title || '',
    });
  }

  if (confirmAction.value === 'end-recurrence') {
    return t('pages.events.endRecurrenceDescription', {
      date: formatDateLabel(selectedOccurrence.value?.occurrenceDate),
    });
  }

  return '';
});

const confirmLabel = computed(() => {
  if (confirmAction.value === 'delete-occurrence') return t('pages.events.deleteOccurrenceLabel');
  if (confirmAction.value === 'delete-series') return t('pages.events.deleteSeriesLabel');
  if (confirmAction.value === 'end-recurrence') return t('pages.events.endRecurrenceLabel');
  return t('common.confirm');
});

async function loadSeriesDetails(seriesId: string) {
  detailsLoading.value = true;
  try {
    selectedSeries.value = await $fetch<EventSeriesDetails>(`/api/events/${seriesId}`);
  } catch {
    selectedSeries.value = null;
    toast.error(t('pages.events.loadError'));
  } finally {
    detailsLoading.value = false;
  }
}

function openActionConfirmation(action: Exclude<EventActionType, null>) {
  confirmAction.value = action;
  confirmDialogOpen.value = true;
}

function closeActionConfirmation() {
  confirmDialogOpen.value = false;
  confirmAction.value = null;
}

async function handleEditSelected() {
  const occurrence = selectedOccurrence.value;
  if (!occurrence?.seriesId) return;

  detailsOpen.value = false;
  await navigateTo(`/events/${occurrence.seriesId}/edit`);
}

async function deleteOccurrence() {
  const occurrence = selectedOccurrence.value;
  if (!occurrence) return;

  await $fetch(`/api/events/occurrences/${occurrence.id}`, {
    method: 'PUT',
    body: {
      seriesId: occurrence.seriesId,
      originalOccurrenceDate: toDateOnly(occurrence.occurrenceDate),
      cancelled: true,
    },
  });

  toast.success(t('pages.events.deleteOccurrenceSuccess'));
  closeDetails();
  refetchCalendarEvents();
}

async function deleteSeries() {
  const occurrence = selectedOccurrence.value;
  if (!occurrence) return;

  await $fetch(`/api/events/${occurrence.seriesId}`, { method: 'DELETE' });
  toast.success(t('pages.events.deleteSuccess'));
  closeDetails();
  refetchCalendarEvents();
}

async function endRecurrence() {
  const occurrence = selectedOccurrence.value;
  const series = selectedSeries.value;
  if (!occurrence || !series) return;

  const monthlyStartTime =
    minutesToTime(series.sameTimeStartMinutes) || getTimeFromIso(occurrence.startAt);

  await $fetch(`/api/events/${series.id}`, {
    method: 'PUT',
    body: {
      title: series.title,
      description: series.description,
      congregationId: series.congregationId,
      departmentId: series.departmentId,
      eventType: series.eventType,
      startsOn: toDateOnly(series.startsOn),
      endsOn: toDateOnly(occurrence.occurrenceDate),
      sameTimeStart:
        series.eventType === EventSeriesType.MONTHLY_RECURRING ? null : monthlyStartTime,
      daySchedules: series.daySchedules.map((entry) => ({
        date: toDateOnly(entry.date),
        startTime: minutesToTime(entry.startMinutes),
      })),
      monthlyRule:
        series.eventType === EventSeriesType.MONTHLY_RECURRING
          ? {
              weekday: series.monthlyWeekday ?? 0,
              ordinal: series.monthlyOrdinal ?? 1,
              startTime: monthlyStartTime,
            }
          : null,
    },
  });

  toast.success(t('pages.events.endRecurrenceSuccess'));
  closeDetails();
  refetchCalendarEvents();
}

async function handleConfirmAction() {
  if (!confirmAction.value) return;

  actionLoading.value = true;

  try {
    if (confirmAction.value === 'delete-occurrence') {
      await deleteOccurrence();
    }

    if (confirmAction.value === 'delete-series') {
      await deleteSeries();
    }

    if (confirmAction.value === 'end-recurrence') {
      await endRecurrence();
    }

    closeActionConfirmation();
  } catch {
    toast.error(t('pages.events.updateError'));
  } finally {
    actionLoading.value = false;
  }
}

async function loadCalendarEvents(
  fetchInfo: { startStr: string; endStr: string },
  successCallback: (events: EventInput[]) => void,
  failureCallback: (error: Error) => void,
) {
  loading.value = true;

  try {
    const apiEvents = await $fetch<EventOccurrence[]>('/api/events', {
      query: {
        start: fetchInfo.startStr,
        end: fetchInfo.endStr,
      },
    });

    const mapped: EventInput[] = apiEvents.map((item) => ({
      id: item.id,
      title: item.title,
      start: toCalendarWallDateTime(item.startAt),
      end: toCalendarWallDateTime(item.endAt),
      extendedProps: {
        seriesId: item.series?.id || item.seriesId,
        occurrenceDate: item.occurrenceDate,
        rawStartAt: item.startAt,
        rawEndAt: item.endAt,
        description: item.description,
        congregationName: item.congregation?.name,
        departmentName: item.department?.name,
        eventType: item.series?.eventType,
        startsOn: item.series?.startsOn,
        endsOn: item.series?.endsOn,
        monthlyWeekday: item.series?.monthlyWeekday,
        monthlyOrdinal: item.series?.monthlyOrdinal,
      },
    }));

    successCallback(mapped);
  } catch {
    failureCallback(new Error(t('pages.events.loadError')));
    toast.error(t('pages.events.loadError'));
  } finally {
    loading.value = false;
  }
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

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  fixedWeekCount: false,
  locale: getCalendarLocale(),
  locales: [ptBrLocale, enLocale],
  height: '100%',
  dayMaxEvents: true,
  editable: false,
  eventDisplay: 'auto',
  eventTimeFormat: {
    hour: '2-digit',
    minute: '2-digit',
    meridiem: false,
    hour12: false,
  },
  timeZone: 'local',
  dayHeaderContent: (arg) => buildDayHeaderLabel(arg.date),
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'exportCalendar loadingBadge',
  },
  customButtons: {
    loadingBadge: {
      text: t('common.loading'),
      click: () => {},
    },
    exportCalendar: {
      text: t('pages.events.export.button'),
      click: () => openExportDialog(),
    },
  },
  buttonText: {
    today: t('common.today'),
    month: t('pages.events.monthView'),
  },
  events: (fetchInfo, successCallback, failureCallback) => {
    loadCalendarEvents(fetchInfo, successCallback, failureCallback).catch(() => {
      failureCallback(new Error(t('pages.events.loadError')));
    });
  },
  datesSet: () => {
    if (detailsOpen.value) {
      closeDetails();
    }
    if (createOpen.value) {
      closeCreate();
    }
  },
  dateClick: (arg: DateClickArg) => {
    if (arg.dayEl.closest('.fc-day-other')) return;

    if (createOpen.value) return;

    if (detailsOpen.value) {
      closeDetails();
    }

    addPlaceholderEvent(arg.dateStr);

    const placement = resolveDetailsPlacement({
      clientX: arg.jsEvent.clientX,
      clientY: arg.jsEvent.clientY,
      eventElement: arg.dayEl,
    });
    createPosition.value = placement.position;
    createSide.value = placement.side;
    createInitialDate.value = arg.dateStr;
    createOpen.value = true;
  },
  select: () => {
    if (detailsOpen.value) {
      closeDetails();
    }
  },
  eventClick: (info) => {
    info.jsEvent.preventDefault();

    if (info.el.closest('.fc-day-other')) return;

    if (createOpen.value) {
      closeCreate();
    }

    const props = info.event.extendedProps as CalendarExtendedProps;
    const seriesId = String(props.seriesId || '');
    const occurrenceDate = String(props.occurrenceDate || '');

    if (!seriesId || !occurrenceDate || !props.rawStartAt || !props.rawEndAt) {
      toast.error(t('pages.events.loadError'));
      return;
    }

    const placement = resolveDetailsPlacement({
      clientX: info.jsEvent.clientX,
      clientY: info.jsEvent.clientY,
      eventElement: info.el,
    });
    detailsPosition.value = placement.position;
    detailsSide.value = placement.side;

    selectedOccurrence.value = {
      id: info.event.id,
      seriesId,
      title: info.event.title,
      description: props.description || null,
      occurrenceDate: toDateOnly(occurrenceDate),
      startAt: props.rawStartAt,
      endAt: props.rawEndAt,
      congregationName: props.congregationName,
      departmentName: props.departmentName,
      eventType: props.eventType,
    };

    detailsOpen.value = true;
    loadSeriesDetails(seriesId).catch(() => {
      toast.error(t('pages.events.loadError'));
    });
  },
  eventDidMount: (info) => {
    const props = info.event.extendedProps as CalendarExtendedProps;
    const eventType = String(props.eventType || 'SINGLE_DAY');
    const typeStyles = getEventTypeStyles(eventType);
    info.el.style.setProperty('--event-dot-color', typeStyles.dot);
    info.el.style.setProperty('--event-border-color', typeStyles.border);
    info.el.style.setProperty('--event-bg-color', typeStyles.bg);
    info.el.style.setProperty('--event-bg-hover-color', typeStyles.bgHover);
    info.el.classList.add('fc-event-has-type-dot');

    const congregationName = props.congregationName;
    const departmentName = props.departmentName;
    const tooltip = [info.event.title, congregationName, departmentName]
      .filter(Boolean)
      .join(' • ');
    const element = info.el;
    element.title = tooltip;
  },
}));
</script>

<template>
  <div class="h-full min-h-0">
    <div class="relative flex h-full min-h-0 flex-col rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3 md:px-6">
        <div>
          <h1 class="text-xl font-semibold tracking-tight md:text-2xl">
            {{ $t('pages.events.title') }}
          </h1>
          <p class="text-muted-foreground text-sm">{{ $t('pages.events.description') }}</p>
        </div>
        <Button as-child>
          <NuxtLink to="/events/new">
            <Plus class="mr-2 size-4" />
            {{ $t('pages.events.new') }}
          </NuxtLink>
        </Button>
      </div>

      <div class="min-h-0 flex-1 p-2 md:p-4">
        <ClientOnly>
          <div
            ref="calendarContainerRef"
            :class="[
              'fc-shadcn-theme h-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm',
              { 'is-calendar-loading': loading },
            ]"
          >
            <FullCalendar ref="calendarRef" :options="calendarOptions" />
          </div>
          <template #fallback>
            <div class="flex h-full min-h-60 items-center justify-center rounded-xl border bg-card">
              <Spinner class="text-muted-foreground size-6" />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="detailsOpen" class="fixed inset-0 z-40" @click="closeDetails" />
  </Teleport>

  <Popover v-model:open="detailsOpen">
    <PopoverAnchor as-child>
      <span
        class="pointer-events-none fixed z-40 size-2"
        :style="{
          left: `${detailsPosition.x}px`,
          top: `${detailsPosition.y}px`,
        }"
      />
    </PopoverAnchor>
    <PopoverContent
      align="center"
      :side="detailsSide"
      :side-offset="10"
      :collision-padding="12"
      class="w-104 max-w-[calc(100vw-1rem)] p-0"
      @open-auto-focus.prevent
      @interact-outside.prevent
    >
      <div class="space-y-2 border-b px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div
              class="line-clamp-2 text-lg font-semibold leading-tight flex flex-row items-center gap-2"
            >
              <span
                class="size-2.5 block rounded"
                :style="{
                  backgroundColor: getEventTypeStyles(
                    selectedSeries?.eventType || selectedOccurrence?.eventType || 'SINGLE_DAY',
                  ).dot,
                }"
              />
              {{ selectedOccurrence?.title || '-' }}
            </div>
            <p class="text-muted-foreground text-xs">
              {{ formatEventTypeLabel(selectedSeries?.eventType || selectedOccurrence?.eventType) }}
            </p>
          </div>

          <TooltipProvider :delay-duration="120">
            <div class="flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    :disabled="actionLoading"
                    :title="$t('pages.events.editAction')"
                    :aria-label="$t('pages.events.editAction')"
                    @click="handleEditSelected"
                  >
                    <Pencil class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{{ $t('pages.events.editAction') }}</TooltipContent>
              </Tooltip>

              <Tooltip v-if="canDeleteOccurrence">
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    :disabled="actionLoading"
                    :title="$t('pages.events.deleteOccurrenceLabel')"
                    :aria-label="$t('pages.events.deleteOccurrenceLabel')"
                    @click="openActionConfirmation('delete-occurrence')"
                  >
                    <CalendarMinus class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {{ $t('pages.events.deleteOccurrenceLabel') }}
                </TooltipContent>
              </Tooltip>

              <Tooltip v-if="canEndRecurrence">
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    :disabled="actionLoading"
                    :title="$t('pages.events.endRecurrenceLabel')"
                    :aria-label="$t('pages.events.endRecurrenceLabel')"
                    @click="openActionConfirmation('end-recurrence')"
                  >
                    <CalendarX2 class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {{ $t('pages.events.endRecurrenceLabel') }}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="text-destructive hover:text-destructive"
                    :disabled="actionLoading"
                    :title="$t('pages.events.deleteSeriesLabel')"
                    :aria-label="$t('pages.events.deleteSeriesLabel')"
                    @click="openActionConfirmation('delete-series')"
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{{
                  $t('pages.events.deleteSeriesLabel')
                }}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    :title="$t('common.close')"
                    :aria-label="$t('common.close')"
                    @click="closeDetails"
                  >
                    <X class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{{ $t('common.close') }}</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>

      <div v-if="detailsLoading" class="space-y-2 px-4 py-4">
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-10/12" />
        <Skeleton class="h-4 w-8/12" />
      </div>

      <div v-else class="space-y-3 px-4 py-4">
        <div class="space-y-2 text-sm">
          <div class="rounded-md border bg-muted/20 px-3 py-2">
            <p class="text-muted-foreground text-xs">{{ $t('pages.events.detailsDate') }}</p>
            <p class="mt-1 font-medium">
              {{ formatDateLabel(selectedOccurrence?.occurrenceDate) }}
            </p>
          </div>
          <div class="rounded-md border bg-muted/20 px-3 py-2">
            <p class="text-muted-foreground text-xs">{{ $t('pages.events.detailsTime') }}</p>
            <p class="mt-1 font-medium">
              {{ selectedOccurrence ? formatStartTimeLabel(selectedOccurrence.startAt) : '-' }}
            </p>
          </div>
          <div class="rounded-md border bg-muted/20 px-3 py-2">
            <p class="text-muted-foreground text-xs">{{ $t('pages.events.detailsRecurrence') }}</p>
            <p class="mt-1 font-medium">{{ recurrenceLabel }}</p>
          </div>
          <div class="rounded-md border bg-muted/20 px-3 py-2">
            <p class="text-muted-foreground text-xs">
              {{ $t('pages.events.detailsRecurrenceRange') }}
            </p>
            <p class="mt-1 font-medium">{{ recurrenceRangeLabel }}</p>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-md border bg-muted/20 px-3 py-2">
              <p class="text-muted-foreground text-xs">
                {{ $t('pages.events.detailsCongregation') }}
              </p>
              <p class="mt-1 font-medium">{{ selectedOccurrence?.congregationName || '-' }}</p>
            </div>
            <div class="rounded-md border bg-muted/20 px-3 py-2">
              <p class="text-muted-foreground text-xs">
                {{ $t('pages.events.detailsDepartment') }}
              </p>
              <p class="mt-1 font-medium">{{ selectedOccurrence?.departmentName || '-' }}</p>
            </div>
          </div>
        </div>

        <div v-if="selectedOccurrence?.description" class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-muted-foreground text-xs">{{ $t('form.event.description') }}</p>
          <p class="mt-1 text-sm whitespace-pre-wrap">{{ selectedOccurrence.description }}</p>
        </div>
      </div>
    </PopoverContent>
  </Popover>

  <Teleport to="body">
    <div v-if="createOpen" class="fixed inset-0 z-40" @click="closeCreate" />
  </Teleport>

  <Popover v-model:open="createOpen">
    <PopoverAnchor as-child>
      <span
        class="pointer-events-none fixed z-40 size-2"
        :style="{
          left: `${createPosition.x}px`,
          top: `${createPosition.y}px`,
        }"
      />
    </PopoverAnchor>
    <PopoverContent
      align="center"
      :side="createSide"
      :side-offset="10"
      :collision-padding="12"
      class="w-140 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-2rem)] overflow-y-auto p-0"
      @open-auto-focus.prevent
      @interact-outside.prevent
    >
      <div class="space-y-1 border-b px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="text-lg font-semibold leading-tight">
              {{ $t('pages.events.new') }}
            </div>
            <p class="text-muted-foreground text-xs">
              {{ $t('pages.events.newDescription') }}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            :title="$t('common.close')"
            :aria-label="$t('common.close')"
            @click="closeCreate"
          >
            <X class="size-4" />
          </Button>
        </div>
      </div>

      <div class="px-4 py-4">
        <EventForm
          v-if="createOpen"
          :initial-data="createInitialData"
          :loading="createLoading"
          :hide-back-button="true"
          @submit="handleCreateSubmit"
          @preview="updatePlaceholderEvent"
        />
      </div>
    </PopoverContent>
  </Popover>

  <ConfirmDialog
    :open="confirmDialogOpen"
    :title="confirmTitle"
    :description="confirmDescription"
    :confirm-label="confirmLabel"
    :loading="actionLoading"
    :variant="confirmAction === 'end-recurrence' ? 'default' : 'destructive'"
    @confirm="handleConfirmAction"
    @cancel="closeActionConfirmation"
  />

  <CalendarExportDialog v-model:open="exportDialogOpen" :current-month="exportCurrentMonth" />
</template>

<style scoped>
:deep(.fc-shadcn-theme) {
  --calendar-toolbar-height: 3.25rem;
}

:deep(.fc-shadcn-theme .fc) {
  height: 100%;
  color: var(--foreground);
  font-size: 0.875rem;
  --fc-border-color: var(--border);
}

:deep(.fc-shadcn-theme .fc-event) {
  cursor: pointer;
}

:deep(.fc-shadcn-theme .fc .fc-scrollgrid-section-body > td) {
  height: 1px;
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-body) {
  height: 100%;
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-body table) {
  height: 100%;
}

:deep(.fc-shadcn-theme .fc-theme-standard .fc-scrollgrid),
:deep(.fc-shadcn-theme .fc-theme-standard td),
:deep(.fc-shadcn-theme .fc-theme-standard th),
:deep(.fc-shadcn-theme .fc .fc-scrollgrid-section > *) {
  border-color: var(--fc-border-color) !important;
  border-style: solid;
}

:deep(.fc-shadcn-theme .fc-scrollgrid) {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 0 !important;
}

:deep(.fc-shadcn-theme .fc .fc-scrollgrid > thead > tr.fc-scrollgrid-section-header > th) {
  border: none !important;
}

:deep(.fc-shadcn-theme .fc .fc-scrollgrid > tbody > tr.fc-scrollgrid-section-body > td) {
  border: none !important;
}

:deep(.fc-shadcn-theme .fc .fc-toolbar.fc-header-toolbar) {
  margin: 0;
  min-height: var(--calendar-toolbar-height);
  padding: 0.75rem;
  border-bottom: 1px solid color-mix(in oklab, var(--muted-foreground) 20%, transparent);
  background: color-mix(in oklab, var(--card) 92%, transparent);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

:deep(.fc-shadcn-theme .fc .fc-toolbar.fc-header-toolbar .fc-toolbar-chunk:first-child) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-self: start;
}

:deep(
  .fc-shadcn-theme .fc .fc-toolbar.fc-header-toolbar .fc-toolbar-chunk:first-child .fc-button-group
) {
  display: inline-flex;
  gap: 0.5rem;
}

:deep(
  .fc-shadcn-theme
    .fc
    .fc-toolbar.fc-header-toolbar
    .fc-toolbar-chunk:first-child
    .fc-button-group
    > .fc-button
) {
  margin: 0;
  border-radius: calc(var(--radius) - 2px) !important;
}

:deep(.fc-shadcn-theme .fc .fc-toolbar.fc-header-toolbar .fc-toolbar-chunk:nth-child(2)) {
  justify-self: center;
}

:deep(.fc-shadcn-theme .fc .fc-toolbar.fc-header-toolbar .fc-toolbar-chunk:last-child) {
  justify-self: end;
}

:deep(.fc-shadcn-theme .fc .fc-loadingBadge-button.fc-button) {
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-color: var(--border);
  background: color-mix(in oklab, var(--card) 92%, transparent);
  font-size: 0.75rem;
  padding-inline: 0.55rem;
}

:deep(.fc-shadcn-theme .fc .fc-loadingBadge-button.fc-button::before) {
  content: '';
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 9999px;
  border: 2px solid color-mix(in oklab, var(--foreground) 80%, transparent);
  border-right-color: transparent;
  animation: calendar-loading-spin 0.7s linear infinite;
}

:deep(.fc-shadcn-theme:not(.is-calendar-loading) .fc .fc-loadingBadge-button.fc-button) {
  display: none;
}

:deep(.fc-shadcn-theme.is-calendar-loading .fc .fc-loadingBadge-button.fc-button) {
  display: inline-flex;
}

:deep(.fc-shadcn-theme .fc .fc-exportCalendar-button.fc-button) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  cursor: pointer;
}

:deep(.fc-shadcn-theme .fc .fc-toolbar-title) {
  font-size: 1rem;
  font-weight: 600;
  color: var(--foreground);
}

:deep(.fc-shadcn-theme .fc .fc-toolbar-title::first-letter) {
  text-transform: uppercase;
}

:deep(.fc-shadcn-theme .fc .fc-button) {
  border: 1px solid var(--input);
  background: var(--background);
  color: var(--foreground);
  box-shadow: none;
  border-radius: calc(var(--radius) - 2px);
  padding: 0.4rem 0.65rem;
  font-size: 0.8125rem;
  line-height: 1.1;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

:deep(.fc-shadcn-theme .fc .fc-button:hover) {
  background: var(--accent);
  color: var(--accent-foreground);
  border-color: var(--accent);
}

:deep(.fc-shadcn-theme .fc .fc-button-primary:not(:disabled).fc-button-active),
:deep(.fc-shadcn-theme .fc .fc-button-primary:not(:disabled):active) {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-foreground);
  box-shadow: none;
}

:deep(.fc-shadcn-theme .fc .fc-button:focus-visible) {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-day-frame),
:deep(.fc-shadcn-theme .fc .fc-list-table tr),
:deep(.fc-shadcn-theme .fc .fc-list-day-cushion) {
  background: color-mix(in oklab, var(--card) 95%, transparent);
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-day-number),
:deep(.fc-shadcn-theme .fc .fc-col-header-cell-cushion),
:deep(.fc-shadcn-theme .fc .fc-list-day-text),
:deep(.fc-shadcn-theme .fc .fc-list-day-side-text) {
  color: var(--foreground);
  font-weight: 500;
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-day-top) {
  justify-content: center;
  padding-top: 0.2rem;
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-day-number) {
  float: none;
  margin-inline: auto;
  text-align: center;
}

:deep(.fc-shadcn-theme .fc .fc-col-header-cell-cushion) {
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-size: 0.675rem;
}

:deep(.fc-shadcn-theme .fc .fc-day-today) {
  background: color-mix(in oklab, var(--accent) 14%, transparent) !important;
}

:deep(.fc-shadcn-theme .fc .fc-day-other .fc-daygrid-day-number) {
  color: var(--muted-foreground);
}

:deep(.fc-shadcn-theme .fc .fc-day-other .fc-event) {
  opacity: 0.4;
  pointer-events: none;
}

:deep(.fc-shadcn-theme .fc .fc-day-other) {
  cursor: default;
}

:deep(.fc-shadcn-theme .fc .fc-list-empty) {
  background: var(--card);
  color: var(--muted-foreground);
}

:deep(.fc-shadcn-theme .fc .fc-event) {
  border: 1px solid var(--event-border-color, color-mix(in oklab, var(--primary) 38%, transparent));
  background: var(--event-bg-color, color-mix(in oklab, var(--primary) 14%, transparent));
  color: var(--foreground);
  border-radius: 0.45rem;
  padding: 0;
}

:deep(.fc-shadcn-theme .fc .fc-event:hover) {
  background: var(--event-bg-hover-color, color-mix(in oklab, var(--primary) 19%, transparent));
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-event-dot) {
  display: inline-block;
  border-color: var(--event-dot-color, var(--chart-1)) !important;
  border-width: 0.34rem;
  margin-right: 0.35rem;
}

:deep(.fc-shadcn-theme .fc .fc-event-main) {
  padding: 0;
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-dot-event) {
  border: 0;
  background: transparent;
  padding: 0.1rem 0;
}

:deep(.fc-shadcn-theme .fc .fc-daygrid-more-link) {
  color: var(--primary);
  font-weight: 500;
}

:deep(.fc-shadcn-theme .fc .fc-list-table) {
  border-collapse: separate;
  border-spacing: 0 0.5rem;
}

:deep(.fc-shadcn-theme .fc .fc-list) {
  border-radius: 0.75rem;
  overflow: hidden;
}

:deep(.fc-shadcn-theme .fc .fc-list-table > tbody > tr:first-child > *) {
  border-top-width: 0 !important;
}

:deep(.fc-shadcn-theme .fc .fc-list-table > tbody > tr:first-child > *:first-child) {
  border-top-left-radius: 0.75rem;
}

:deep(.fc-shadcn-theme .fc .fc-list-table > tbody > tr:first-child > *:last-child) {
  border-top-right-radius: 0.75rem;
}

:deep(.fc-shadcn-theme .fc .fc-list-day) {
  background: transparent;
}

:deep(.fc-shadcn-theme .fc .fc-list-day > *) {
  background: transparent !important;
}

:deep(.fc-shadcn-theme .fc .fc-list-day-cushion) {
  background: color-mix(in oklab, var(--muted) 25%, transparent) !important;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.55rem 0.75rem;
}

:deep(.fc-shadcn-theme .fc .fc-list-day-cushion.fc-cell-shaded) {
  background: color-mix(in oklab, var(--muted) 25%, transparent) !important;
}

:deep(.fc-shadcn-theme .fc .fc-list-day-cushion a) {
  text-decoration: none;
}

:deep(.fc-shadcn-theme .fc .fc-list-day-text) {
  font-weight: 600;
  color: var(--foreground);
}

:deep(.fc-shadcn-theme .fc .fc-list-day-side-text) {
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 500;
}

:deep(.fc-shadcn-theme .fc .fc-list-event td) {
  background: color-mix(in oklab, var(--card) 95%, transparent);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding-block: 0.45rem;
}

:deep(.fc-shadcn-theme .fc .fc-list-event td:first-child) {
  border-top-left-radius: 0.45rem;
  border-bottom-left-radius: 0.45rem;
  border-left: 3px solid
    var(--event-border-color, color-mix(in oklab, var(--primary) 60%, transparent));
  padding-left: 0.65rem;
}

:deep(.fc-shadcn-theme .fc .fc-list-event td:last-child) {
  border-top-right-radius: 0.45rem;
  border-bottom-right-radius: 0.45rem;
  border-right: 1px solid var(--border);
}

:deep(.fc-shadcn-theme .fc .fc-list-empty) {
  border-radius: 0.75rem;
}

:deep(.fc-shadcn-theme .fc .fc-list-event:hover td) {
  background: color-mix(in oklab, var(--accent) 25%, transparent);
}

:deep(.fc-shadcn-theme .fc .fc-list-event-time) {
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  width: 6.5rem;
}

:deep(.fc-shadcn-theme .fc .fc-list-event-title) {
  font-weight: 500;
}

:deep(.fc-shadcn-theme .fc .fc-list-event-title a) {
  color: var(--foreground);
  text-decoration: none;
}

:deep(.fc-shadcn-theme .fc .fc-highlight) {
  background: color-mix(in oklab, var(--accent) 30%, transparent);
}

:deep(.fc-shadcn-theme .fc .fc-placeholder-event) {
  background: var(--muted) !important;
  border-color: var(--muted) !important;
  pointer-events: none;
}

:deep(.fc-shadcn-theme .fc .fc-placeholder-no-time .fc-event-time) {
  display: none;
}

:deep(.fc-shadcn-theme .fc .fc-placeholder-event:not(.fc-placeholder-has-title) .fc-event-title) {
  color: var(--muted-foreground);
}

:deep(.fc-shadcn-theme .fc .fc-placeholder-has-title .fc-event-title) {
  color: var(--primary);
}

:deep(.fc-shadcn-theme .fc .fc-placeholder-has-time .fc-event-time) {
  color: var(--primary);
}

:deep(.fc-shadcn-theme .fc .fc-timegrid-now-indicator-line) {
  border-color: var(--destructive);
}

:deep(.fc-shadcn-theme .fc .fc-timegrid-now-indicator-arrow) {
  border-color: var(--destructive);
}

@keyframes calendar-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
