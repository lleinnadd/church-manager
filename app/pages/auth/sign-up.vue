<script setup lang="ts">
definePageMeta({
  layout: 'auth',
});
</script>

<template>
  <SignUp routing="path" path="/auth/sign-up" sign-in-url="/auth/sign-in" />
</template>
