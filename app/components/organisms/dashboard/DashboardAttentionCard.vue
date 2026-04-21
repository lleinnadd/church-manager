<script setup lang="ts">
import { AlertTriangle } from '@lucide/vue';

defineProps<{
  withoutLeadership: { id: string; name: string }[];
  withoutMembers: { id: string; name: string }[];
  incompleteProfiles: number;
  withoutDepartment: number;
  withoutCongregation: number;
}>();
</script>

<template>
  <Card class="h-full">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-base">
        <AlertTriangle class="size-4 text-amber-500" />
        {{ $t('pages.home.attention.title') }}
      </CardTitle>
      <CardDescription>{{ $t('pages.home.attention.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4 text-sm">
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-md border p-2 text-center">
          <div class="text-lg font-semibold tabular-nums">{{ incompleteProfiles }}</div>
          <div class="text-muted-foreground mt-0.5 text-xs">
            {{ $t('pages.home.attention.incompleteProfiles') }}
          </div>
        </div>
        <div class="rounded-md border p-2 text-center">
          <div class="text-lg font-semibold tabular-nums">{{ withoutDepartment }}</div>
          <div class="text-muted-foreground mt-0.5 text-xs">
            {{ $t('pages.home.attention.withoutDepartment') }}
          </div>
        </div>
        <div class="rounded-md border p-2 text-center">
          <div class="text-lg font-semibold tabular-nums">{{ withoutCongregation }}</div>
          <div class="text-muted-foreground mt-0.5 text-xs">
            {{ $t('pages.home.attention.withoutCongregation') }}
          </div>
        </div>
      </div>

      <div v-if="withoutLeadership.length">
        <div class="text-muted-foreground mb-1.5 text-xs uppercase tracking-wide">
          {{ $t('pages.home.attention.congregationsWithoutLeadership') }}
        </div>
        <div class="flex flex-wrap gap-1.5">
          <Badge v-for="c in withoutLeadership" :key="c.id" variant="outline" class="text-xs">
            {{ c.name }}
          </Badge>
        </div>
      </div>

      <div v-if="withoutMembers.length">
        <div class="text-muted-foreground mb-1.5 text-xs uppercase tracking-wide">
          {{ $t('pages.home.attention.departmentsWithoutMembers') }}
        </div>
        <div class="flex flex-wrap gap-1.5">
          <Badge v-for="d in withoutMembers" :key="d.id" variant="outline" class="text-xs">
            {{ d.name }}
          </Badge>
        </div>
      </div>

      <div
        v-if="
          !withoutLeadership.length &&
          !withoutMembers.length &&
          !incompleteProfiles &&
          !withoutDepartment &&
          !withoutCongregation
        "
        class="text-muted-foreground py-2 text-center text-sm"
      >
        {{ $t('pages.home.attention.allGood') }}
      </div>
    </CardContent>
  </Card>
</template>
