<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { EventFormPayload } from '@/types/forms';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'events', action: 'CREATE' },
});

const { t } = useI18n();
const router = useRouter();
const loading = ref(false);

async function handleSubmit(data: EventFormPayload) {
  loading.value = true;
  try {
    await $fetch('/api/events', { method: 'POST', body: data });
    toast.success(t('pages.events.createSuccess'));
    await router.push('/events');
  } catch {
    toast.error(t('pages.events.createError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.events.new') }}</h1>
      <p class="text-muted-foreground text-sm">{{ $t('pages.events.newDescription') }}</p>
    </div>

    <EventForm :loading="loading" @submit="handleSubmit" />
  </div>
</template>
