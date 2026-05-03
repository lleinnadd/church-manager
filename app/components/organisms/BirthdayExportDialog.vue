<script setup lang="ts">
import { Download } from '@lucide/vue';
import { toast } from 'vue-sonner';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const { t, locale } = useI18n();

const {
  selectedYear,
  selectedMonths,
  loading,
  monthsToExport,
  toggleMonth,
  selectAllMonths,
  clearSelectedMonths,
  exportBirthdays,
  reset,
} = useBirthdayExport();

const dialogOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
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
    await exportBirthdays();
    toast.success(t('birthdayExport.success'));
    dialogOpen.value = false;
  } catch {
    toast.error(t('birthdayExport.error'));
  }
}
</script>

<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t('birthdayExport.title') }}</DialogTitle>
        <DialogDescription>{{ $t('birthdayExport.description') }}</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label class="text-sm font-medium">{{ $t('birthdayExport.yearLabel') }}</Label>
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

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-medium">{{ $t('birthdayExport.monthsLabel') }}</Label>
            <div class="flex gap-2">
              <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="selectAllMonths">
                {{ $t('birthdayExport.selectAll') }}
              </Button>
              <span class="text-muted-foreground text-xs">|</span>
              <Button
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs"
                @click="clearSelectedMonths"
              >
                {{ $t('birthdayExport.clear') }}
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
      </div>

      <DialogFooter class="mt-2">
        <Button variant="outline" :disabled="loading" @click="dialogOpen = false">
          {{ $t('common.cancel') }}
        </Button>
        <Button :disabled="!canExport || loading" @click="handleExport">
          <Spinner v-if="loading" class="mr-2 size-4" />
          <Download v-else class="mr-2 size-4" />
          {{ loading ? $t('birthdayExport.generating') : $t('birthdayExport.download') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
