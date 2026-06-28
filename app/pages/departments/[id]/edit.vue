<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { DepartmentFormData, DepartmentFormPayload } from '@/types/forms';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'departments', action: 'UPDATE' },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(false);

const id = route.params.id as string;

const { data: department, status } = useFetch<DepartmentFormData>(`/api/departments/${id}`);
const isLoading = computed(() => status.value === 'pending');

async function handleSubmit(data: DepartmentFormPayload) {
  loading.value = true;
  try {
    await $fetch(`/api/departments/${id}`, { method: 'PUT', body: data });
    toast.success(t('pages.departments.updateSuccess'));
    await router.push('/departments');
  } catch {
    toast.error(t('pages.departments.updateError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.departments.editTitle') }}</h1>
      <p class="text-muted-foreground text-sm">{{ $t('pages.departments.editDescription') }}</p>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <Skeleton class="h-40 w-full rounded-xl" />
      <Skeleton class="h-40 w-full rounded-xl" />
    </div>

    <DepartmentForm
      v-else-if="department"
      :initial-data="department"
      :loading="loading"
      @submit="handleSubmit"
    />
  </div>
</template>
