<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { CongregationFormData, CongregationFormPayload } from '@/types/forms';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'congregations', action: 'UPDATE' },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(false);

const id = route.params.id as string;

const { data: congregation, status } = useFetch<CongregationFormData>(`/api/congregations/${id}`);

const isLoading = computed(() => status.value === 'pending');

async function handleSubmit(data: CongregationFormPayload) {
  loading.value = true;
  try {
    await $fetch(`/api/congregations/${id}`, {
      method: 'PUT',
      body: data,
    });
    toast.success(t('pages.congregations.updateSuccess'));
    await router.push('/congregations');
  } catch {
    toast.error(t('pages.congregations.updateError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.congregations.editTitle') }}</h1>
      <p class="text-muted-foreground text-sm">{{ $t('pages.congregations.editDescription') }}</p>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <Skeleton class="h-64 w-full rounded-xl" />
      <Skeleton class="h-64 w-full rounded-xl" />
    </div>

    <CongregationForm
      v-else-if="congregation"
      :initial-data="congregation"
      :loading="loading"
      @submit="handleSubmit"
    />
  </div>
</template>
