<script setup lang="ts">
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
