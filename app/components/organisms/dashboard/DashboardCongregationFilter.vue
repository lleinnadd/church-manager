<script setup lang="ts">
import type { DashboardCongregationLite } from '~~/shared/types/stats';

const props = defineProps<{
  modelValue: string | null;
  congregations: DashboardCongregationLite[];
  viewerCongregationId?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const ALL = '__all__';

const selected = computed({
  get: () => props.modelValue ?? ALL,
  set: (value: string) => emit('update:modelValue', value === ALL ? null : value),
});
</script>

<template>
  <Select v-model="selected">
    <SelectTrigger class="w-full sm:w-72">
      <SelectValue :placeholder="$t('pages.home.filter.placeholder')" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem :value="ALL">
        {{ $t('pages.home.filter.all') }}
      </SelectItem>
      <SelectSeparator />
      <SelectItem v-for="c in congregations" :key="c.id" :value="c.id">
        <div class="flex items-center gap-2">
          <span>{{ c.name }}</span>
          <span v-if="viewerCongregationId === c.id" class="text-muted-foreground text-xs">
            · {{ $t('pages.home.filter.yours') }}
          </span>
        </div>
      </SelectItem>
    </SelectContent>
  </Select>
</template>
