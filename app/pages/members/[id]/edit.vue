<script setup lang="ts">
import { Shield } from '@lucide/vue';
import { toast } from 'vue-sonner';
import type { MemberFormData, MemberFormPayload } from '@/types/forms';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'members', action: 'UPDATE' },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const { isAdmin: viewerIsAdmin } = usePermissions();

const id = route.params.id as string;

const {
  data: member,
  status,
  refresh,
} = useFetch<MemberFormData & { isAdmin?: boolean }>(`/api/members/${id}`);
const isLoading = computed(() => status.value === 'pending');

const togglingAdmin = ref(false);

async function handleToggleAdmin(checked: boolean) {
  togglingAdmin.value = true;
  try {
    await $fetch(`/api/members/${id}`, {
      method: 'PUT',
      body: { ...member.value, isAdmin: checked },
    });
    toast.success(t('rbac.saved'));
    await refresh();
  } catch {
    toast.error(t('common.errorGeneric'));
  } finally {
    togglingAdmin.value = false;
  }
}

async function handleSubmit(data: MemberFormPayload) {
  loading.value = true;
  try {
    await $fetch(`/api/members/${id}`, { method: 'PUT', body: data });
    toast.success(t('pages.members.updateSuccess'));
    await router.push('/members');
  } catch {
    toast.error(t('pages.members.updateError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.members.editTitle') }}</h1>
      <p class="text-muted-foreground text-sm">{{ $t('pages.members.editDescription') }}</p>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <Skeleton class="h-64 w-full rounded-xl" />
      <Skeleton class="h-64 w-full rounded-xl" />
    </div>

    <template v-else-if="member">
      <div v-if="viewerIsAdmin" class="flex items-center justify-between rounded-lg border p-4">
        <div class="flex items-center gap-3">
          <Shield class="size-5 text-muted-foreground" />
          <div>
            <p class="font-medium">{{ $t('rbac.isAdmin') }}</p>
            <p class="text-sm text-muted-foreground">{{ $t('rbac.isAdminDescription') }}</p>
          </div>
        </div>
        <Switch
          :checked="member.isAdmin ?? false"
          :disabled="togglingAdmin"
          @update:checked="handleToggleAdmin"
        />
      </div>

      <MemberForm :initial-data="member" :loading="loading" @submit="handleSubmit" />
    </template>
  </div>
</template>
