<script setup lang="ts">
definePageMeta({
  layout: 'auth',
});
</script>

<template>
  <SignIn routing="path" path="/auth/sign-in" sign-up-url="/auth/sign-up" />
</template>
