<script setup lang="ts">
import 'vue-sonner/style.css';
import { useColorMode } from '@/composables/useColorMode';

const { resolvedMode } = useColorMode();

useHead(() => ({
  htmlAttrs: {
    class: resolvedMode.value === 'dark' ? 'dark' : '',
  },
}));

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
