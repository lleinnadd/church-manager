<script setup lang="ts">
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
  </NuxtLayout>
</template>
