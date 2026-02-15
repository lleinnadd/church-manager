<script setup lang="ts">
definePageMeta({
  layout: false,
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <SignUp routing="path" path="/auth/sign-up" sign-in-url="/auth/sign-in" />
  </div>
</template>
