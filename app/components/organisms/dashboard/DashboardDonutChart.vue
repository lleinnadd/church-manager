<script setup lang="ts">
interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

const props = defineProps<{
  segments: Segment[];
  total?: number;
  centerLabel?: string;
}>();

const totalValue = computed(
  () => props.total ?? props.segments.reduce((sum, s) => sum + s.value, 0),
);

const radius = 60;
const stroke = 18;
const circumference = 2 * Math.PI * radius;

const segmentsWithGeo = computed(() => {
  if (totalValue.value === 0) return [];
  let offset = 0;
  return props.segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = s.value / totalValue.value;
      const length = fraction * circumference;
      const dasharray = `${length} ${circumference - length}`;
      const dashoffset = circumference - offset;
      offset += length;
      return { ...s, dasharray, dashoffset, fraction };
    });
});
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="relative">
      <svg :width="(radius + stroke) * 2" :height="(radius + stroke) * 2" class="-rotate-90">
        <circle
          :cx="radius + stroke"
          :cy="radius + stroke"
          :r="radius"
          fill="none"
          class="stroke-muted"
          :stroke-width="stroke"
        />
        <circle
          v-for="seg in segmentsWithGeo"
          :key="seg.key"
          :cx="radius + stroke"
          :cy="radius + stroke"
          :r="radius"
          fill="none"
          :stroke="seg.color"
          :stroke-width="stroke"
          :stroke-dasharray="seg.dasharray"
          :stroke-dashoffset="seg.dashoffset"
          stroke-linecap="butt"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <div class="text-2xl font-semibold leading-none">{{ totalValue }}</div>
        <div v-if="centerLabel" class="text-muted-foreground mt-1 text-xs">
          {{ centerLabel }}
        </div>
      </div>
    </div>
    <div class="grid w-full gap-1.5 text-sm">
      <div v-for="seg in segments" :key="seg.key" class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="size-2.5 shrink-0 rounded-full" :style="{ background: seg.color }" />
          <span class="text-muted-foreground truncate">{{ seg.label }}</span>
        </div>
        <span class="font-medium tabular-nums">{{ seg.value }}</span>
      </div>
    </div>
  </div>
</template>
