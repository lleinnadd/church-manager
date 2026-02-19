<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner';
import 'vue-sonner/style.css';

useHead({
  htmlAttrs: {
    class: 'dark',
  },
});

if (import.meta.client) {
  useClerkLocale();
}
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
    <Toaster />
  </NuxtLayout>
</template>
