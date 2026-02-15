<script setup lang="ts">
import { Church, Plus, Pencil, Trash2, MapPin, Users } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type { Congregation } from '@prisma/client';

type CongregationWithCount = Congregation & { _count: { members: number } };

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
    toast.success('Congregation deleted successfully');
    refresh();
  } catch {
    toast.error('Failed to delete congregation');
  } finally {
    isDeleting.value = false;
    deleteTarget.value = null;
  }
}

function formatDate(date: string | Date | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR');
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
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Congregations</h1>
        <p class="text-muted-foreground text-sm">
          Manage your congregations and their information.
        </p>
      </div>
      <Button as-child>
        <NuxtLink to="/congregations/new">
          <Plus class="mr-2 size-4" />
          New Congregation
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
        <EmptyTitle>No congregations yet</EmptyTitle>
        <EmptyDescription>Get started by creating your first congregation.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button as-child>
          <NuxtLink to="/congregations/new">
            <Plus class="mr-2 size-4" />
            New Congregation
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
              <CardDescription v-if="congregation.since">
                Since {{ formatDate(congregation.since) }}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm">
                  <span class="sr-only">Actions</span>
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
                    Edit
                  </NuxtLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-destructive"
                  @click="confirmDelete(congregation.id, congregation.name)"
                >
                  <Trash2 class="mr-2 size-4" />
                  Delete
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
          <div class="text-muted-foreground flex items-center gap-2 text-sm">
            <Users class="size-4 shrink-0" />
            <span
              >{{ congregation._count.members }}
              {{ congregation._count.members === 1 ? 'member' : 'members' }}</span
            >
          </div>
        </CardContent>
      </Card>
    </div>

    <ConfirmDialog
      :open="!!deleteTarget"
      title="Delete congregation"
      :description="`Are you sure you want to delete '${deleteTarget?.name}'? This action cannot be undone.`"
      confirm-label="Delete"
      variant="destructive"
      :loading="isDeleting"
      @confirm="handleDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
