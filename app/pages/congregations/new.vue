<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { CongregationFormPayload } from '@/types/forms';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'congregations', action: 'CREATE' },
});

const { t } = useI18n();
const router = useRouter();
const loading = ref(false);

async function handleSubmit(data: CongregationFormPayload) {
  loading.value = true;
  try {
    await $fetch('/api/congregations', {
      method: 'POST',
      body: data,
    });
    toast.success(t('pages.congregations.createSuccess'));
    await router.push('/congregations');
  } catch {
    toast.error(t('pages.congregations.createError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.congregations.new') }}</h1>
      <p class="text-muted-foreground text-sm">{{ $t('pages.congregations.newDescription') }}</p>
    </div>

    <CongregationForm :loading="loading" @submit="handleSubmit" />
  </div>
</template>
