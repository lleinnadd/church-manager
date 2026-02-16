<script setup lang="ts">
import { toast } from 'vue-sonner';

const { t } = useI18n();
const router = useRouter();
const loading = ref(false);

async function handleSubmit(data: any) {
  loading.value = true;
  try {
    await $fetch('/api/departments', { method: 'POST', body: data });
    toast.success(t('pages.departments.createSuccess'));
    router.push('/departments');
  } catch {
    toast.error(t('pages.departments.createError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.departments.new') }}</h1>
      <p class="text-muted-foreground text-sm">{{ $t('pages.departments.newDescription') }}</p>
    </div>

    <DepartmentForm :loading="loading" @submit="handleSubmit" />
  </div>
</template>
