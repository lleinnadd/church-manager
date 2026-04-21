<script setup lang="ts">
interface BarItem {
  key: string;
  label: string;
  value: number;
  hint?: string;
  color?: string;
}

const props = defineProps<{
  items: BarItem[];
  max?: number;
}>();

const maxValue = computed(() => {
  const fromProp = props.max ?? 0;
  const fromItems = props.items.reduce((m, i) => Math.max(m, i.value), 0);
  return Math.max(fromProp, fromItems, 1);
});
</script>

<template>
  <div class="space-y-3">
    <div v-for="item in items" :key="item.key" class="space-y-1">
      <div class="flex items-baseline justify-between gap-2 text-sm">
        <span class="text-muted-foreground truncate">{{ item.label }}</span>
        <span class="font-medium tabular-nums">
          {{ item.value }}
          <span v-if="item.hint" class="text-muted-foreground ml-1 text-xs">{{ item.hint }}</span>
        </span>
      </div>
      <div class="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          class="h-full rounded-full transition-all"
          :style="{
            width: `${(item.value / maxValue) * 100}%`,
            background: item.color ?? 'hsl(var(--primary))',
          }"
        />
      </div>
    </div>
  </div>
</template>
