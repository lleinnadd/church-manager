<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { PermissionAction, PermissionScopeType, DepartmentScope } from '@prisma/client';
import { Plus, Trash2, Link } from '@lucide/vue';
import type { PendingBinding } from '@/components/organisms/RbacBindingPicker.vue';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'rbac', action: 'MANAGE' },
});

const { t } = useI18n();
const route = useRoute();
const loading = ref(false);

const profileId = route.params.id as string;

interface ProfileBinding {
  id: string;
  scope: DepartmentScope;
  function: {
    id: string;
    name: string;
    department: { id: string; name: string };
  };
}

interface ProfileData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: {
    resource: string;
    action: PermissionAction;
    scopeType: PermissionScopeType;
  }[];
  bindings: ProfileBinding[];
}

interface ProfileFormData {
  name: string;
  description: string;
  permissions: {
    resource: string;
    action: PermissionAction;
    scopeType: PermissionScopeType;
  }[];
}

const { data: profile, refresh, status } = useFetch<ProfileData>(`/api/rbac/profiles/${profileId}`);

const isLoading = computed(() => status.value === 'pending');

async function handleSubmit(data: ProfileFormData) {
  loading.value = true;
  try {
    await $fetch(`/api/rbac/profiles/${profileId}`, {
      method: 'PUT',
      body: data,
    });
    toast.success(t('rbac.saved'));
    await refresh();
  } catch {
    toast.error(t('common.errorGeneric'));
  } finally {
    loading.value = false;
  }
}

const pendingBindings = ref<PendingBinding[]>([]);
const isAddingBinding = ref(false);

async function handleAddBindings() {
  if (!pendingBindings.value.length) return;
  isAddingBinding.value = true;
  try {
    await $fetch(`/api/rbac/profiles/${profileId}/bindings`, {
      method: 'POST',
      body: {
        bindings: pendingBindings.value.map((b) => ({
          functionId: b.functionId,
          scope: b.scope,
        })),
      },
    });
    toast.success(t('rbac.bindingAdded'));
    pendingBindings.value = [];
    await refresh();
  } catch {
    toast.error(t('common.errorGeneric'));
  } finally {
    isAddingBinding.value = false;
  }
}

const deleteBindingTarget = ref<string | null>(null);
const isDeletingBinding = ref(false);

async function handleDeleteBinding() {
  if (!deleteBindingTarget.value) return;
  isDeletingBinding.value = true;
  try {
    await $fetch(`/api/rbac/profiles/${profileId}/bindings/${deleteBindingTarget.value}`, {
      method: 'DELETE',
    });
    toast.success(t('rbac.bindingDeleted'));
    await refresh();
  } catch {
    toast.error(t('common.errorGeneric'));
  } finally {
    isDeletingBinding.value = false;
    deleteBindingTarget.value = null;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <p class="text-muted-foreground">{{ $t('common.loading') }}</p>
    </div>

    <template v-else-if="profile">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('rbac.editProfile') }}</h1>
        <p class="text-sm text-muted-foreground">{{ profile.name }}</p>
      </div>

      <RbacProfileForm :loading="loading" :initial-data="profile" @submit="handleSubmit" />

      <Separator />

      <div class="space-y-4">
        <h2 class="text-lg font-semibold">{{ $t('rbac.bindings') }}</h2>
        <p class="text-sm text-muted-foreground">
          {{ $t('rbac.bindings') }}
        </p>

        <div v-if="profile.bindings?.length" class="space-y-2">
          <div
            v-for="binding in profile.bindings"
            :key="binding.id"
            class="flex items-center justify-between rounded-lg border p-3"
          >
            <div class="flex items-center gap-2">
              <Link class="size-4 text-muted-foreground" />
              <span class="font-medium">
                {{ binding.function.department.name }} — {{ binding.function.name }}
              </span>
              <Badge variant="outline">{{ binding.scope }}</Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 text-destructive"
              @click="deleteBindingTarget = binding.id"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>

        <p v-else class="text-sm text-muted-foreground">{{ $t('rbac.noBindings') }}</p>

        <Separator />

        <RbacBindingPicker v-model="pendingBindings" />

        <div class="flex justify-end">
          <Button :disabled="!pendingBindings.length || isAddingBinding" @click="handleAddBindings">
            <Plus class="mr-2 size-4" />
            {{ $t('rbac.saveBindings') }}
          </Button>
        </div>
      </div>
    </template>

    <AlertDialog :open="!!deleteBindingTarget" @update:open="deleteBindingTarget = null">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t('common.confirm') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ $t('rbac.deleteBindingConfirm') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeletingBinding">
            {{ $t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction :disabled="isDeletingBinding" @click="handleDeleteBinding">
            {{ $t('common.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
