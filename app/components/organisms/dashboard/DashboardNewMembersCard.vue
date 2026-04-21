<script setup lang="ts">
import { UserPlus } from '@lucide/vue';
import type { DashboardNewMember } from '~~/shared/types/stats';

defineProps<{
  members: DashboardNewMember[];
}>();

const { locale } = useI18n();

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(locale.value, {
    day: '2-digit',
    month: 'short',
  });
}
</script>

<template>
  <Card class="h-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-base">
        <UserPlus class="size-4" />
        {{ $t('pages.home.newMembers.title') }}
      </CardTitle>
      <CardDescription>{{ $t('pages.home.newMembers.description') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="!members.length" class="text-muted-foreground py-6 text-center text-sm">
        {{ $t('pages.home.newMembers.empty') }}
      </div>
      <ul v-else class="space-y-3">
        <li v-for="m in members" :key="m.id" class="flex items-center gap-3">
          <Avatar class="size-9">
            <AvatarImage v-if="m.photoUrl" :src="m.photoUrl" :alt="m.name" />
            <AvatarFallback>{{ initials(m.name) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{{ m.name }}</div>
            <div class="text-muted-foreground text-xs">{{ formatDate(m.memberSince) }}</div>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
