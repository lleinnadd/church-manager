<script setup lang="ts">
import { Download } from '@lucide/vue';
import { toast } from 'vue-sonner';

const props = defineProps<{
  open: boolean;
  currentMonth: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const { t, locale } = useI18n();

const {
  exportMode,
  selectedYear,
  selectedMonths,
  loading,
  includeMiniCalendars,
  monthsToExport,
  monthsAreSequential,
  setCurrentMonth,
  toggleMonth,
  selectAllMonths,
  clearSelectedMonths,
  exportCalendar,
  reset,
} = useCalendarExport();

const dialogOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

watch(
  () => props.currentMonth,
  (value) => setCurrentMonth(value),
  { immediate: true },
);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      setCurrentMonth(props.currentMonth);
      if (!selectedYear.value) {
        const [yearStr] = props.currentMonth.split('-');
        selectedYear.value = Number(yearStr);
      }
    } else {
      reset();
    }
  },
);

const monthOptions = computed(() => {
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2024, i, 1);
    const label = date.toLocaleString(locale.value, { month: 'long' });
    const value = `${selectedYear.value}-${String(i + 1).padStart(2, '0')}`;
    return { label: label.charAt(0).toUpperCase() + label.slice(1), value };
  });
});

const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
});

const canExport = computed(() => monthsToExport.value.length > 0);

async function handleExport() {
  try {
    await exportCalendar();
    toast.success(t('pages.events.export.success'));
    dialogOpen.value = false;
  } catch {
    toast.error(t('pages.events.export.error'));
  }
}
</script>

<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t('pages.events.export.title') }}</DialogTitle>
        <DialogDescription>{{ $t('pages.events.export.description') }}</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Export mode -->
        <div class="space-y-2">
          <Label class="text-sm font-medium">{{ $t('pages.events.export.modeLabel') }}</Label>
          <RadioGroup v-model="exportMode" class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <RadioGroupItem id="mode-current" value="current" />
              <Label for="mode-current" class="font-normal cursor-pointer">
                {{ $t('pages.events.export.currentMonth') }}
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroupItem id="mode-year" value="year" />
              <Label for="mode-year" class="font-normal cursor-pointer">
                {{ $t('pages.events.export.fullYear') }}
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroupItem id="mode-custom" value="custom" />
              <Label for="mode-custom" class="font-normal cursor-pointer">
                {{ $t('pages.events.export.selectMonths') }}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <!-- Year selector (for year and custom modes) -->
        <div v-if="exportMode === 'year' || exportMode === 'custom'" class="space-y-2">
          <Label class="text-sm font-medium">{{ $t('pages.events.export.year') }}</Label>
          <Select v-model="selectedYear">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="year in yearOptions" :key="year" :value="year">
                {{ year }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Month grid (for custom mode) -->
        <div v-if="exportMode === 'custom'" class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-medium">{{ $t('pages.events.export.months') }}</Label>
            <div class="flex gap-2">
              <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="selectAllMonths">
                {{ $t('pages.events.export.selectAll') }}
              </Button>
              <span class="text-muted-foreground text-xs">|</span>
              <Button
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs"
                @click="clearSelectedMonths"
              >
                {{ $t('pages.events.export.clearAll') }}
              </Button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <label
              v-for="month in monthOptions"
              :key="month.value"
              class="border-input hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
              :class="{
                'bg-primary/5 border-primary/30': selectedMonths.includes(month.value),
              }"
            >
              <Checkbox
                :model-value="selectedMonths.includes(month.value)"
                @update:model-value="toggleMonth(month.value)"
              />
              {{ month.label }}
            </label>
          </div>
        </div>

        <!-- Mini calendars toggle -->
        <div class="space-y-1">
          <label
            class="flex items-start gap-2"
            :class="{
              'cursor-not-allowed opacity-50': !monthsAreSequential,
              'cursor-pointer': monthsAreSequential,
            }"
          >
            <Checkbox
              :model-value="monthsAreSequential && includeMiniCalendars"
              :disabled="!monthsAreSequential"
              @update:model-value="(value) => (includeMiniCalendars = value === true)"
            />
            <div class="flex flex-col">
              <span class="text-sm font-medium">{{
                $t('pages.events.export.includeMiniCalendars')
              }}</span>
              <span v-if="!monthsAreSequential" class="text-muted-foreground text-xs">{{
                $t('pages.events.export.miniCalendarsRequiresSequential')
              }}</span>
            </div>
          </label>
        </div>
      </div>

      <DialogFooter class="mt-2">
        <Button variant="outline" :disabled="loading" @click="dialogOpen = false">
          {{ $t('common.cancel') }}
        </Button>
        <Button :disabled="!canExport || loading" @click="handleExport">
          <Spinner v-if="loading" class="mr-2 size-4" />
          <Download v-else class="mr-2 size-4" />
          {{ loading ? $t('pages.events.export.generating') : $t('pages.events.export.download') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
