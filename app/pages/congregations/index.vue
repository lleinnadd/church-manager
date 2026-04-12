<script setup lang="ts">
import { Church, Plus, Pencil, Trash2, MapPin, Users, UserRound } from '@lucide/vue';
import type { CongregationType, Congregation } from '@prisma/client';
import { toast } from 'vue-sonner';

const { t, locale } = useI18n();

interface CongregationLeadershipData {
  responsibles: { memberName: string }[];
}

type CongregationWithCount = Congregation & {
  _count: { members: number };
  leadership?: CongregationLeadershipData | null;
};

const {
  data: congregations,
  refresh,
  status,
} = useFetch<CongregationWithCount[]>('/api/congregations');

const isLoading = computed(() => status.value === 'pending');

const deleteTarget = ref<{ id: string; name: string } | null>(null);
const isDeleting = ref(false);

function confirmDelete(id: string, name: string) {
  deleteTarget.value = { id, name };
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/congregations/${deleteTarget.value.id}`, { method: 'DELETE' });
    toast.success(t('pages.congregations.deleteSuccess'));
    await refresh();
  } catch {
    toast.error(t('pages.congregations.deleteError'));
  } finally {
    isDeleting.value = false;
    deleteTarget.value = null;
  }
}

function formatDate(date: string | Date | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(locale.value);
}

function formatAddress(congregation: CongregationWithCount) {
  const parts = [
    congregation.addressLinePrimary,
    congregation.district,
    congregation.city,
    congregation.state,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatType(type: CongregationType) {
  const labels: Record<CongregationType, string> = {
    HEADQUARTERS: t('form.congregation.type.headquarters'),
    BRANCH: t('form.congregation.type.branch'),
    SUB_BRANCH: t('form.congregation.type.subBranch'),
  };
  return labels[type] ?? type;
}

function getResponsibleName(congregation: CongregationWithCount) {
  return congregation.leadership?.responsibles?.[0]?.memberName || null;
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.congregations.title') }}</h1>
        <p class="text-muted-foreground text-sm">
          {{ $t('pages.congregations.description') }}
        </p>
      </div>
      <Button as-child>
        <NuxtLink to="/congregations/new">
          <Plus class="mr-2 size-4" />
          {{ $t('pages.congregations.new') }}
        </NuxtLink>
      </Button>
    </div>

    <div v-if="isLoading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="i in 3" :key="i" class="h-48 w-full rounded-xl" />
    </div>

    <Empty v-else-if="!congregations?.length" class="min-h-100">
      <EmptyMedia variant="icon">
        <Church class="size-8" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{{ $t('pages.congregations.emptyTitle') }}</EmptyTitle>
        <EmptyDescription>{{ $t('pages.congregations.emptyDescription') }}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button as-child>
          <NuxtLink to="/congregations/new">
            <Plus class="mr-2 size-4" />
            {{ $t('pages.congregations.new') }}
          </NuxtLink>
        </Button>
      </EmptyContent>
    </Empty>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="congregation in congregations" :key="congregation.id" class="group relative">
        <CardHeader>
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <CardTitle class="truncate text-lg">{{ congregation.name }}</CardTitle>
              <div class="text-xs tracking-wide text-muted-foreground">
                {{ formatType(congregation.type) }}
              </div>
              <CardDescription v-if="congregation.since">
                {{ $t('common.since', { date: formatDate(congregation.since) }) }}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm">
                  <span class="sr-only">{{ $t('common.actions') }}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem as-child>
                  <NuxtLink :to="`/congregations/${congregation.id}/edit`">
                    <Pencil class="mr-2 size-4" />
                    {{ $t('common.edit') }}
                  </NuxtLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-destructive"
                  @select="confirmDelete(congregation.id, congregation.name)"
                >
                  <Trash2 class="mr-2 size-4" />
                  {{ $t('common.delete') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent class="space-y-3">
          <div
            v-if="formatAddress(congregation)"
            class="text-muted-foreground flex items-start gap-2 text-sm"
          >
            <MapPin class="mt-0.5 size-4 shrink-0" />
            <span>{{ formatAddress(congregation) }}</span>
          </div>
          <div class="text-muted-foreground flex items-start gap-2 text-sm">
            <UserRound class="mt-0.5 size-4 shrink-0" />
            <span>
              {{ $t('pages.congregations.responsibleLabel') }}:
              {{ getResponsibleName(congregation) || $t('pages.congregations.noResponsible') }}
            </span>
          </div>
        </CardContent>
        <CardFooter class="text-muted-foreground flex items-center gap-2 text-sm mt-auto">
          <Users class="size-4 shrink-0" />
          <span>
            {{ congregation._count.members }}
            {{ congregation._count.members === 1 ? $t('common.member') : $t('common.members') }}
          </span>
        </CardFooter>
      </Card>
    </div>

    <ConfirmDialog
      :open="!!deleteTarget"
      :title="$t('pages.congregations.deleteTitle')"
      :description="$t('pages.congregations.deleteDescription', { name: deleteTarget?.name })"
      :confirm-label="$t('common.delete')"
      variant="destructive"
      :loading="isDeleting"
      @confirm="handleDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
