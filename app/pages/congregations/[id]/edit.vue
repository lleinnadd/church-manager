<script setup lang="ts">
import { toast } from 'vue-sonner';

const route = useRoute();
const router = useRouter();
const loading = ref(false);

const id = route.params.id as string;

const { data: congregation, status } = useFetch(`/api/congregations/${id}`);

const isLoading = computed(() => status.value === 'pending');

async function handleSubmit(data: any) {
  loading.value = true;
  try {
    await $fetch(`/api/congregations/${id}`, {
      method: 'PUT',
      body: data,
    });
    toast.success('Congregation updated successfully');
    router.push('/congregations');
  } catch {
    toast.error('Failed to update congregation');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Edit Congregation</h1>
      <p class="text-muted-foreground text-sm">Update the congregation details.</p>
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
