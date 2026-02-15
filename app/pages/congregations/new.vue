<script setup lang="ts">
import { toast } from 'vue-sonner';

const router = useRouter();
const loading = ref(false);

async function handleSubmit(data: any) {
  loading.value = true;
  try {
    await $fetch('/api/congregations', {
      method: 'POST',
      body: data,
    });
    toast.success('Congregation created successfully');
    router.push('/congregations');
  } catch {
    toast.error('Failed to create congregation');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">New Congregation</h1>
      <p class="text-muted-foreground text-sm">Fill in the details to create a new congregation.</p>
    </div>

    <CongregationForm :loading="loading" @submit="handleSubmit" />
  </div>
</template>
