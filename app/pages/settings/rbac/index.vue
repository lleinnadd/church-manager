<script setup lang="ts">
import { Shield, Plus, Pencil, Trash2, Link } from '@lucide/vue';
import { toast } from 'vue-sonner';

definePageMeta({
  middleware: ['rbac'],
  requireAdmin: true,
});

const { t } = useI18n();

interface RbacProfileListItem {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  _count: { permissions: number; bindings: number };
}

const { data: profiles, refresh, status } = useFetch<RbacProfileListItem[]>('/api/rbac/profiles');

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
    await $fetch(`/api/rbac/profiles/${deleteTarget.value.id}`, { method: 'DELETE' });
    toast.success(t('rbac.deleted'));
    await refresh();
  } catch {
    toast.error(t('common.errorGeneric'));
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
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('rbac.title') }}</h1>
      </div>
      <Button size="sm" as-child>
        <NuxtLink to="/settings/rbac/new">
          <Plus class="mr-2 size-4" />
          {{ $t('rbac.newProfile') }}
        </NuxtLink>
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <p class="text-muted-foreground">{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="!profiles?.length" class="flex flex-col items-center justify-center py-12">
      <Shield class="mb-4 size-12 text-muted-foreground" />
      <p class="text-muted-foreground">{{ $t('rbac.noProfiles') }}</p>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="profile in profiles" :key="profile.id">
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <CardTitle class="text-base">{{ profile.name }}</CardTitle>
              <CardDescription v-if="profile.description">
                {{ profile.description }}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="size-8">
                  <Pencil class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem as-child>
                  <NuxtLink :to="`/settings/rbac/${profile.id}/edit`">
                    <Pencil class="mr-2 size-4" />
                    {{ $t('common.edit') }}
                  </NuxtLink>
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="!profile.isSystem"
                  class="text-destructive"
                  @click="confirmDelete(profile.id, profile.name)"
                >
                  <Trash2 class="mr-2 size-4" />
                  {{ $t('common.delete') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-4 text-sm text-muted-foreground">
            <div class="flex items-center gap-1">
              <Shield class="size-4" />
              <span>{{ profile._count.permissions }}</span>
            </div>
            <div class="flex items-center gap-1">
              <Link class="size-4" />
              <span>{{ profile._count.bindings }}</span>
            </div>
            <Badge v-if="profile.isSystem" variant="secondary">
              {{ $t('rbac.systemProfile') }}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>

    <AlertDialog :open="!!deleteTarget" @update:open="deleteTarget = null">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t('common.confirm') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ $t('rbac.deleteConfirm') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">{{ $t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction :disabled="isDeleting" @click="handleDelete">
            {{ $t('common.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
