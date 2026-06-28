<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { PermissionAction, PermissionScopeType, DepartmentScope } from '@prisma/client';
import { Plus, Trash2, Link } from '@lucide/vue';

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

interface DepartmentWithFunctions {
  id: string;
  name: string;
  functions: { id: string; name: string }[];
}

const { data: departments } = useFetch<DepartmentWithFunctions[]>('/api/departments');

const bindingFunctionId = ref('');
const bindingScope = ref<DepartmentScope | ''>('');
const isAddingBinding = ref(false);

async function handleAddBinding() {
  if (!bindingFunctionId.value || !bindingScope.value) return;
  isAddingBinding.value = true;
  try {
    await $fetch(`/api/rbac/profiles/${profileId}/bindings`, {
      method: 'POST',
      body: {
        functionId: bindingFunctionId.value,
        scope: bindingScope.value,
      },
    });
    toast.success(t('rbac.bindingAdded'));
    bindingFunctionId.value = '';
    bindingScope.value = '';
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

const functionOptions = computed(() => {
  if (!departments.value) return [];
  return departments.value.flatMap((dept: DepartmentWithFunctions) =>
    (dept.functions ?? []).map((fn) => ({
      value: fn.id,
      label: `${dept.name} — ${fn.name}`,
    })),
  );
});
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

        <div class="flex items-end gap-2">
          <div class="flex-1">
            <Label>{{ $t('rbac.function') }}</Label>
            <Select v-model="bindingFunctionId">
              <SelectTrigger>
                <SelectValue :placeholder="$t('rbac.selectFunction')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in functionOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="w-48">
            <Label>{{ $t('rbac.scope') }}</Label>
            <Select v-model="bindingScope">
              <SelectTrigger>
                <SelectValue :placeholder="$t('rbac.selectScope')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOCAL">LOCAL</SelectItem>
                <SelectItem value="GENERAL">GENERAL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            :disabled="!bindingFunctionId || !bindingScope || isAddingBinding"
            @click="handleAddBinding"
          >
            <Plus class="mr-2 size-4" />
            {{ $t('rbac.addBinding') }}
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
