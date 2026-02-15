<script setup lang="ts">
definePageMeta({
  layout: false,
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <SignIn routing="path" path="/auth/sign-in" sign-up-url="/auth/sign-up" />
  </div>
</template>
