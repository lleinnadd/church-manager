<script setup lang="ts">
const props = defineProps<{
  label: string;
  value: number | string;
  hint?: string;
  icon?: Component;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}>();

const variantClass = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'warning':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'danger':
      return 'bg-red-500/10 text-red-600 dark:text-red-400';
    default:
      return 'bg-primary/10 text-primary';
  }
});
</script>

<template>
  <Card class="py-0">
    <CardContent class="flex items-center gap-4 p-4">
      <div
        v-if="icon"
        :class="['flex size-10 shrink-0 items-center justify-center rounded-lg', variantClass]"
      >
        <component :is="icon" class="size-5" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-muted-foreground truncate text-xs uppercase tracking-wide">
          {{ label }}
        </div>
        <div class="text-2xl font-semibold leading-tight">{{ value }}</div>
        <div v-if="hint" class="text-muted-foreground truncate text-xs">{{ hint }}</div>
      </div>
    </CardContent>
  </Card>
</template>
