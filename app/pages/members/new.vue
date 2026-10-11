<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { MemberFormPayload } from '@/types/forms';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'members', action: 'CREATE' },
});

const { t } = useI18n();
const router = useRouter();
const loading = ref(false);

async function handleSubmit(data: MemberFormPayload) {
  loading.value = true;
  try {
    await $fetch('/api/members', { method: 'POST', body: data });
    toast.success(t('pages.members.createSuccess'));
    await router.push('/members');
  } catch {
    toast.error(t('pages.members.createError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.members.new') }}</h1>
      <p class="text-muted-foreground text-sm">{{ $t('pages.members.newDescription') }}</p>
    </div>

    <MemberForm :loading="loading" @submit="handleSubmit" />
  </div>
</template>
