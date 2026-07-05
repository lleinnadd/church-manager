<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { PermissionAction, PermissionScopeType } from '@prisma/client';
import type { PendingBinding } from '@/components/organisms/RbacBindingPicker.vue';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'rbac', action: 'MANAGE' },
});

const { t } = useI18n();
const router = useRouter();
const loading = ref(false);

const pendingBindings = ref<PendingBinding[]>([]);

interface ProfileFormData {
  name: string;
  description: string;
  permissions: {
    resource: string;
    action: PermissionAction;
    scopeType: PermissionScopeType;
  }[];
}

async function handleSubmit(data: ProfileFormData) {
  loading.value = true;
  try {
    await $fetch('/api/rbac/profiles', {
      method: 'POST',
      body: {
        ...data,
        bindings: pendingBindings.value.map((b) => ({
          functionId: b.functionId,
          scope: b.scope,
        })),
      },
    });
    toast.success(t('rbac.saved'));
    await router.push('/settings/rbac');
  } catch {
    toast.error(t('common.errorGeneric'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('rbac.newProfile') }}</h1>
    </div>

    <RbacProfileForm :loading="loading" @submit="handleSubmit" />

    <Separator />

    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold">{{ $t('rbac.bindings') }}</h2>
        <p class="text-sm text-muted-foreground">{{ $t('rbac.bindingsDescription') }}</p>
      </div>
      <RbacBindingPicker v-model="pendingBindings" />
    </div>
  </div>
</template>
