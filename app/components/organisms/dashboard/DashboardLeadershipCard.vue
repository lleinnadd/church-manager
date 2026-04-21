<script setup lang="ts">
import { Crown } from '@lucide/vue';
import type { DashboardLeadershipEntry } from '~~/shared/types/stats';

defineProps<{
  leadership: DashboardLeadershipEntry[];
}>();
</script>

<template>
  <Card class="h-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-base">
        <Crown class="size-4" />
        {{ $t('pages.home.leadership.title') }}
      </CardTitle>
      <CardDescription>{{ $t('pages.home.leadership.description') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="!leadership.length" class="text-muted-foreground py-6 text-center text-sm">
        {{ $t('pages.home.leadership.empty') }}
      </div>
      <ul v-else class="space-y-3">
        <li v-for="entry in leadership" :key="entry.congregationId" class="space-y-1">
          <div class="text-sm font-medium">{{ entry.congregationName }}</div>
          <div class="flex flex-wrap gap-1.5">
            <Badge
              v-for="r in entry.responsibles"
              :key="`${entry.congregationId}-${r.memberName}-${r.functionName}`"
              variant="secondary"
              class="text-xs"
            >
              <span class="truncate">{{ r.memberName }}</span>
              <span class="text-muted-foreground ml-1">· {{ r.functionName }}</span>
            </Badge>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
