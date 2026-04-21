<script setup lang="ts">
import { Cake } from '@lucide/vue';
import type { DashboardBirthdayMember } from '~~/shared/types/stats';

defineProps<{
  members: DashboardBirthdayMember[];
}>();

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}
</script>

<template>
  <Card class="h-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-base">
        <Cake class="size-4" />
        {{ $t('pages.home.birthdays.title') }}
      </CardTitle>
      <CardDescription>{{ $t('pages.home.birthdays.description') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="!members.length" class="text-muted-foreground py-6 text-center text-sm">
        {{ $t('pages.home.birthdays.empty') }}
      </div>
      <ul v-else class="space-y-3">
        <li v-for="m in members" :key="m.id" class="flex items-center gap-3">
          <Avatar class="size-9">
            <AvatarImage v-if="m.photoUrl" :src="m.photoUrl" :alt="m.name" />
            <AvatarFallback>{{ initials(m.name) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{{ m.name }}</div>
            <div class="text-muted-foreground text-xs">
              {{ $t('pages.home.birthdays.day', { day: m.dayOfMonth }) }}
            </div>
          </div>
          <Badge variant="secondary" class="text-xs tabular-nums">
            {{ String(m.dayOfMonth).padStart(2, '0') }}
          </Badge>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
