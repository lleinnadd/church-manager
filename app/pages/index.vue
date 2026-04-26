<script setup lang="ts">
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CalendarX,
  Image as ImageIcon,
  ShieldCheck,
  UserPlus,
  Users,
} from '@lucide/vue';
import type { CongregationType } from '@prisma/client';

const { t } = useI18n();
const { stats, pending, error, congregationId, refresh } = useDashboardStats();

const isLoading = computed(() => pending.value);

const congregationTypeLabel = (type: CongregationType) => {
  const map: Record<CongregationType, string> = {
    HEADQUARTERS: t('form.congregation.type.headquarters'),
    BRANCH: t('form.congregation.type.branch'),
    SUB_BRANCH: t('form.congregation.type.subBranch'),
  };
  return map[type] ?? type;
};

const memberStatusSegments = computed(() => {
  if (!stats.value) return [];
  const data = stats.value.members.byStatus;
  return [
    {
      key: 'ACTIVE',
      label: t('pages.home.memberStatus.active'),
      value: data.ACTIVE,
      color: '#10b981',
    },
    {
      key: 'TRANSFERRED',
      label: t('pages.home.memberStatus.transferred'),
      value: data.TRANSFERRED,
      color: '#f59e0b',
    },
    {
      key: 'WITHDRAWN',
      label: t('pages.home.memberStatus.withdrawn'),
      value: data.WITHDRAWN,
      color: '#ef4444',
    },
  ];
});

const ageRangeItems = computed(() => {
  if (!stats.value) return [];
  const data = stats.value.members.byAgeRange;
  return [
    { key: '0-12', label: t('pages.home.ageRanges.children'), value: data['0-12'] },
    { key: '13-17', label: t('pages.home.ageRanges.teens'), value: data['13-17'] },
    { key: '18-29', label: t('pages.home.ageRanges.youngAdults'), value: data['18-29'] },
    { key: '30-59', label: t('pages.home.ageRanges.adults'), value: data['30-59'] },
    { key: '60+', label: t('pages.home.ageRanges.seniors'), value: data['60+'] },
  ];
});

const congregationTypeSegments = computed(() => {
  if (!stats.value) return [];
  const data = stats.value.congregationsStats.byType;
  return [
    {
      key: 'HEADQUARTERS',
      label: t('form.congregation.type.headquarters'),
      value: data.HEADQUARTERS,
      color: '#6366f1',
    },
    {
      key: 'BRANCH',
      label: t('form.congregation.type.branch'),
      value: data.BRANCH,
      color: '#8b5cf6',
    },
    {
      key: 'SUB_BRANCH',
      label: t('form.congregation.type.subBranch'),
      value: data.SUB_BRANCH,
      color: '#ec4899',
    },
  ];
});

const eventsByTypeItems = computed(() => {
  if (!stats.value) return [];
  const data = stats.value.events.byType;
  return [
    {
      key: 'SINGLE_DAY',
      label: t('pages.home.eventsByType.singleDay'),
      value: data.SINGLE_DAY,
      color: '#3b82f6',
    },
    {
      key: 'MULTI_DAY',
      label: t('pages.home.eventsByType.multiDay'),
      value: data.MULTI_DAY,
      color: '#8b5cf6',
    },
    {
      key: 'MONTHLY_RECURRING',
      label: t('pages.home.eventsByType.monthlyRecurring'),
      value: data.MONTHLY_RECURRING,
      color: '#10b981',
    },
  ];
});

const topDepartmentItems = computed(() => {
  if (!stats.value) return [];
  return stats.value.departments.topByMembers.map((d) => ({
    key: d.id,
    label: d.name,
    value: d.memberCount,
  }));
});

const eventsByDepartmentItems = computed(() => {
  if (!stats.value) return [];
  return stats.value.events.byDepartment.map((d) => ({
    key: d.departmentId,
    label: d.departmentName,
    value: d.count,
  }));
});

const stateItems = computed(() => {
  if (!stats.value) return [];
  return stats.value.congregationsStats.byState.map((s) => ({
    key: s.state,
    label: s.state,
    value: s.count,
  }));
});

const photoCoveragePct = computed(() => {
  const data = stats.value?.members.photoCoverage;
  if (!data || !data.total) return 0;
  return Math.round((data.withPhoto / data.total) * 100);
});

const platformAdoptionPct = computed(() => {
  const data = stats.value?.members.platformAdoption;
  if (!data || !data.total) return 0;
  return Math.round((data.withClerk / data.total) * 100);
});

const cancellationPct = computed(() => {
  if (!stats.value) return 0;
  return Math.round(stats.value.events.cancellationRate * 100);
});

const scopeBadgeLabel = computed(() => {
  if (!stats.value) return '';
  if (stats.value.scope.isGlobal) return t('pages.home.scope.global');
  return stats.value.scope.congregationName ?? '';
});

const scopeSubtitle = computed(() => {
  if (!stats.value || pending.value) return '';
  if (stats.value.scope.isGlobal) return t('pages.home.scope.globalDescription');
  return t('pages.home.scope.congregationDescription', {
    type: stats.value.scope.congregationType
      ? congregationTypeLabel(stats.value.scope.congregationType)
      : '',
  });
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.home.title') }}</h1>
          <Badge v-if="stats && !isLoading" variant="secondary" class="text-xs">
            {{ scopeBadgeLabel }}
          </Badge>
          <Skeleton v-else-if="isLoading" class="h-5 w-24 rounded-full" />
        </div>
        <p class="text-muted-foreground text-sm">
          {{ scopeSubtitle || $t('pages.home.description') }}
        </p>
      </div>
      <DashboardCongregationFilter
        v-if="stats"
        v-model="congregationId"
        :congregations="stats.congregations"
        :viewer-congregation-id="stats.viewer.congregation?.id ?? null"
      />
      <Skeleton v-else class="h-9 w-full rounded-md sm:w-72" />
    </div>

    <template v-if="isLoading">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton v-for="i in 4" :key="`kpi-skel-${i}`" class="h-24 w-full rounded-xl" />
      </div>
      <div class="gap-4 sm:columns-2 lg:columns-3 *:mb-4 *:break-inside-avoid">
        <Skeleton
          v-for="(h, i) in [320, 240, 280, 360, 200, 300, 260, 320, 220, 280, 240, 260]"
          :key="`masonry-skel-${i}`"
          class="w-full rounded-xl"
          :style="{ height: `${h}px` }"
        />
      </div>
    </template>

    <Card v-else-if="error" class="border-destructive/30">
      <CardContent class="text-destructive flex items-center gap-3 p-6 text-sm">
        <AlertTriangle class="size-5" />
        <div class="flex-1">{{ $t('pages.home.error') }}</div>
        <Button variant="outline" size="sm" @click="refresh">
          {{ $t('common.refresh') }}
        </Button>
      </CardContent>
    </Card>

    <template v-else-if="stats">
      <DashboardViewerNextEventCard
        v-if="stats.viewer.nextEvent"
        :event="stats.viewer.nextEvent"
        :member-name="stats.viewer.memberName"
      />

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardKpiCard
          :label="$t('pages.home.kpi.activeMembers')"
          :value="stats.members.byStatus.ACTIVE"
          :hint="
            $t('pages.home.kpi.activeMembersHint', {
              total: stats.members.total,
            })
          "
          :icon="Users"
          variant="success"
        />
        <DashboardKpiCard
          :label="$t('pages.home.kpi.newMembers')"
          :value="stats.members.newLast30"
          :hint="$t('pages.home.kpi.newMembersHint')"
          :icon="UserPlus"
          variant="default"
        />
        <DashboardKpiCard
          :label="$t('pages.home.kpi.eventsToday')"
          :value="stats.events.todayCount"
          :hint="
            $t('pages.home.kpi.eventsTodayHint', {
              count: stats.events.next7Days,
            })
          "
          :icon="CalendarDays"
          variant="default"
        />
        <DashboardKpiCard
          :label="$t('pages.home.kpi.congregations')"
          :value="stats.congregationsStats.total"
          :hint="
            $t('pages.home.kpi.congregationsHint', {
              departments: stats.departments.total,
            })
          "
          :icon="Building2"
          variant="default"
        />
      </div>

      <div class="gap-4 sm:columns-2 lg:columns-3 *:mb-4 *:break-inside-avoid">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ $t('pages.home.memberStatus.title') }}</CardTitle>
            <CardDescription>{{ $t('pages.home.memberStatus.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardDonutChart
              :segments="memberStatusSegments"
              :center-label="$t('common.members')"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ $t('pages.home.ageRanges.title') }}</CardTitle>
            <CardDescription>{{ $t('pages.home.ageRanges.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardHorizontalBarList :items="ageRangeItems" />
          </CardContent>
        </Card>

        <DashboardBirthdaysCard :members="stats.members.birthdaysThisMonth" />

        <DashboardNewMembersCard :members="stats.members.newMembers" />

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base">
              <ImageIcon class="size-4" />
              {{ $t('pages.home.coverage.title') }}
            </CardTitle>
            <CardDescription>{{ $t('pages.home.coverage.description') }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div>
              <div class="mb-1 flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('pages.home.coverage.photos') }}</span>
                <span class="font-medium tabular-nums">
                  {{ photoCoveragePct }}% ({{ stats.members.photoCoverage.withPhoto }}/{{
                    stats.members.photoCoverage.total
                  }})
                </span>
              </div>
              <Progress :model-value="photoCoveragePct" />
            </div>
            <div>
              <div class="mb-1 flex justify-between text-sm">
                <span class="text-muted-foreground">
                  <ShieldCheck class="mr-1 inline size-3" />
                  {{ $t('pages.home.coverage.platform') }}
                </span>
                <span class="font-medium tabular-nums">
                  {{ platformAdoptionPct }}% ({{ stats.members.platformAdoption.withClerk }}/{{
                    stats.members.platformAdoption.total
                  }})
                </span>
              </div>
              <Progress :model-value="platformAdoptionPct" />
            </div>
          </CardContent>
        </Card>

        <DashboardAttentionCard
          :without-leadership="stats.congregationsStats.withoutLeadership"
          :without-members="stats.departments.withoutMembers"
          :incomplete-profiles="stats.members.incompleteProfiles"
          :without-department="stats.members.withoutDepartment"
          :without-congregation="stats.members.withoutCongregation"
        />

        <DashboardUpcomingEventsList :events="stats.events.upcoming" />

        <DashboardEventCalendarMini :events="stats.events.upcoming" />

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ $t('pages.home.eventsByType.title') }}</CardTitle>
            <CardDescription>
              {{ $t('pages.home.eventsByType.description') }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardHorizontalBarList :items="eventsByTypeItems" />
          </CardContent>
        </Card>

        <DashboardKpiCard
          :label="$t('pages.home.cancellation.title')"
          :value="`${cancellationPct}%`"
          :hint="
            $t('pages.home.cancellation.hint', {
              cancelled: stats.events.cancelledThisMonth,
              total: stats.events.monthTotal + stats.events.cancelledThisMonth,
            })
          "
          :icon="CalendarX"
          :variant="cancellationPct > 20 ? 'danger' : 'warning'"
        />

        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              {{ $t('pages.home.congregationsByType.title') }}
            </CardTitle>
            <CardDescription>
              {{ $t('pages.home.congregationsByType.description') }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardDonutChart
              :segments="congregationTypeSegments"
              :center-label="$t('pages.home.congregationsByType.center')"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ $t('pages.home.byState.title') }}</CardTitle>
            <CardDescription>{{ $t('pages.home.byState.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="!stateItems.length" class="text-muted-foreground py-6 text-center text-sm">
              {{ $t('pages.home.byState.empty') }}
            </div>
            <DashboardHorizontalBarList v-else :items="stateItems" />
          </CardContent>
        </Card>

        <DashboardLeadershipCard :leadership="stats.congregationsStats.leadership" />

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ $t('pages.home.topDepartments.title') }}</CardTitle>
            <CardDescription>{{ $t('pages.home.topDepartments.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              v-if="!topDepartmentItems.length"
              class="text-muted-foreground py-6 text-center text-sm"
            >
              {{ $t('pages.home.topDepartments.empty') }}
            </div>
            <DashboardHorizontalBarList v-else :items="topDepartmentItems" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              {{ $t('pages.home.eventsByDepartment.title') }}
            </CardTitle>
            <CardDescription>
              {{ $t('pages.home.eventsByDepartment.description') }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              v-if="!eventsByDepartmentItems.length"
              class="text-muted-foreground py-6 text-center text-sm"
            >
              {{ $t('pages.home.eventsByDepartment.empty') }}
            </div>
            <DashboardHorizontalBarList v-else :items="eventsByDepartmentItems" />
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
