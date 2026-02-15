<script setup lang="ts">
const clerk = useClerk();

function handleSignOut() {
  clerk.value?.signOut({ redirectUrl: '/auth/sign-in' });
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4">
    <Button variant="destructive" @click="handleSignOut"> Sign out </Button>
  </div>
</template>
