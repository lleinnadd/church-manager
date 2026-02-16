<script setup lang="ts">
import { toast } from 'vue-sonner';
import type { MemberStatus, DepartmentScope } from '@prisma/client';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(false);

const id = route.params.id as string;

interface MemberFormData {
  name: string;
  congregationId: string;
  status: MemberStatus;
  clerkUserId?: string | null;
  departments?: {
    departmentId: string;
    scope: DepartmentScope;
    functionId?: string | null;
    function?: { id: string; name: string; departmentId: string } | null;
    congregationId?: string | null;
  }[];
}

const { data: member, status } = useFetch<MemberFormData>(`/api/members/${id}`);
const isLoading = computed(() => status.value === 'pending');

async function handleSubmit(data: any) {
  loading.value = true;
  try {
    await $fetch(`/api/members/${id}`, { method: 'PUT', body: data });
    toast.success(t('pages.members.updateSuccess'));
    router.push('/members');
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

    <MemberForm
      v-else-if="member"
      :initial-data="member"
      :loading="loading"
      @submit="handleSubmit"
    />
  </div>
</template>
