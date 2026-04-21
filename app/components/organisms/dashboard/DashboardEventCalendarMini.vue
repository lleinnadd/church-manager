<script setup lang="ts">
import { CalendarRange, ChevronLeft, ChevronRight } from '@lucide/vue';

const props = defineProps<{
  highlightedDates: string[]; // ISO yyyy-mm-dd
}>();

const { locale } = useI18n();

const cursor = ref(new Date());

const highlightSet = computed(() => new Set(props.highlightedDates));

const monthLabel = computed(() =>
  cursor.value.toLocaleDateString(locale.value, { month: 'long', year: 'numeric' }),
);

const weekdayLabels = computed(() => {
  const ref = new Date(Date.UTC(2024, 0, 7)); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ref);
    d.setUTCDate(ref.getUTCDate() + i);
    return d.toLocaleDateString(locale.value, { weekday: 'narrow' });
  });
});

interface Cell {
  key: string;
  day: number | null;
  iso?: string;
  isToday?: boolean;
  hasEvent?: boolean;
}

const cells = computed<Cell[]>(() => {
  const year = cursor.value.getFullYear();
  const month = cursor.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const result: Cell[] = [];
  for (let i = 0; i < startWeekday; i += 1) {
    result.push({ key: `pad-${i}`, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    result.push({
      key: iso,
      day,
      iso,
      isToday: iso === todayIso,
      hasEvent: highlightSet.value.has(iso),
    });
  }
  return result;
});

function shiftMonth(delta: number) {
  const next = new Date(cursor.value);
  next.setMonth(next.getMonth() + delta);
  cursor.value = next;
}
</script>

<template>
  <Card class="h-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-base">
        <CalendarRange class="size-4" />
        {{ $t('pages.home.miniCalendar.title') }}
      </CardTitle>
      <CardDescription>{{ $t('pages.home.miniCalendar.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" @click="shiftMonth(-1)">
          <ChevronLeft class="size-4" />
        </Button>
        <span class="text-sm font-medium capitalize">{{ monthLabel }}</span>
        <Button variant="ghost" size="icon-sm" @click="shiftMonth(1)">
          <ChevronRight class="size-4" />
        </Button>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide">
        <div v-for="(label, idx) in weekdayLabels" :key="idx" class="text-muted-foreground py-1">
          {{ label }}
        </div>
      </div>
      <div class="grid grid-cols-7 gap-1">
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="relative flex aspect-square items-center justify-center rounded-md text-xs"
          :class="[
            cell.day === null && 'opacity-0',
            cell.isToday && 'bg-primary text-primary-foreground font-semibold',
            !cell.isToday && cell.hasEvent && 'bg-primary/10 text-foreground font-medium',
            !cell.isToday && !cell.hasEvent && cell.day !== null && 'text-muted-foreground',
          ]"
        >
          <span>{{ cell.day }}</span>
          <span
            v-if="cell.hasEvent && !cell.isToday"
            class="bg-primary absolute bottom-0.5 size-1 rounded-full"
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
