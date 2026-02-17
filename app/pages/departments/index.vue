<script setup lang="ts">
import { Building2, Plus, Pencil, Trash2, Users } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type { Department } from '@prisma/client';

const { t } = useI18n();

interface DepartmentLocalName {
  id: string;
  name: string;
  congregationId: string;
  congregation?: { id: string; name: string } | null;
}

type DepartmentWithCounts = Department & {
  _count: { memberships: number };
  localNames?: DepartmentLocalName[];
};

const { data: departments, refresh, status } = useFetch<DepartmentWithCounts[]>('/api/departments');

const isLoading = computed(() => status.value === 'pending');
const deleteTarget = ref<{ id: string; name: string } | null>(null);
const isDeleting = ref(false);

function localNameLabel(entry: DepartmentLocalName) {
  const congregationName = entry.congregation?.name ?? t('pages.departments.localNameUnknown');
  return t('pages.departments.localNameItem', {
    congregation: congregationName,
    name: entry.name,
  });
}

function confirmDelete(id: string, name: string) {
  deleteTarget.value = { id, name };
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/departments/${deleteTarget.value.id}`, { method: 'DELETE' });
    toast.success(t('pages.departments.deleteSuccess'));
    await refresh();
  } catch {
    toast.error(t('pages.departments.deleteError'));
  } finally {
    isDeleting.value = false;
    deleteTarget.value = null;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.departments.title') }}</h1>
        <p class="text-muted-foreground text-sm">{{ $t('pages.departments.description') }}</p>
      </div>
      <div class="flex gap-2">
        <Button as-child>
          <NuxtLink to="/departments/new">
            <Plus class="mr-2 size-4" />
            {{ $t('pages.departments.new') }}
          </NuxtLink>
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="i in 3" :key="i" class="h-40 w-full rounded-xl" />
    </div>

    <Empty v-else-if="!departments?.length" class="min-h-100">
      <EmptyMedia variant="icon">
        <Building2 class="size-8" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{{ $t('pages.departments.emptyTitle') }}</EmptyTitle>
        <EmptyDescription>{{ $t('pages.departments.emptyDescription') }}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button as-child>
          <NuxtLink to="/departments/new">
            <Plus class="mr-2 size-4" />
            {{ $t('pages.departments.new') }}
          </NuxtLink>
        </Button>
      </EmptyContent>
    </Empty>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="department in departments" :key="department.id" class="group relative">
        <CardHeader>
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <CardTitle class="truncate text-lg">{{ department.name }}</CardTitle>
              <CardDescription class="line-clamp-2">{{ department.description }}</CardDescription>
              <div v-if="department.localNames?.length" class="mt-2 text-xs text-muted-foreground">
                <span class="font-medium">{{ $t('pages.departments.localNamesLabel') }}:</span>
                <span class="ml-1">
                  <span
                    v-for="(entry, index) in department.localNames.slice(0, 2)"
                    :key="entry.id || index"
                  >
                    {{ localNameLabel(entry) }}
                    <span v-if="index < Math.min(department.localNames.length, 2) - 1"> • </span>
                  </span>
                  <span v-if="department.localNames.length > 2" class="ml-1">
                    {{
                      $t('pages.departments.localNamesMore', {
                        count: department.localNames.length - 2,
                      })
                    }}
                  </span>
                </span>
              </div>
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
                  <NuxtLink :to="`/departments/${department.id}/edit`">
                    <Pencil class="mr-2 size-4" />
                    {{ $t('common.edit') }}
                  </NuxtLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-destructive"
                  @click="confirmDelete(department.id, department.name)"
                >
                  <Trash2 class="mr-2 size-4" />
                  {{ $t('common.delete') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent class="text-muted-foreground flex items-center gap-2 text-sm">
          <Users class="size-4" />
          <span>
            {{ department._count.memberships }}
            {{ department._count.memberships === 1 ? $t('common.member') : $t('common.members') }}
          </span>
        </CardContent>
      </Card>
    </div>

    <ConfirmDialog
      :open="!!deleteTarget"
      :title="$t('pages.departments.deleteTitle')"
      :description="$t('pages.departments.deleteDescription', { name: deleteTarget?.name })"
      :confirm-label="$t('common.delete')"
      variant="destructive"
      :loading="isDeleting"
      @confirm="handleDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
