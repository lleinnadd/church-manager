<script setup lang="ts">
import { ShieldX } from '@lucide/vue';

const clerk = useClerk();

async function handleSignOut() {
  await clerk.value?.signOut({ redirectUrl: '/auth/sign-in' });
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="mx-auto max-w-md text-center">
      <ShieldX class="mx-auto mb-6 size-16 text-muted-foreground" />
      <h1 class="mb-2 text-2xl font-bold">{{ $t('noAccess.title') }}</h1>
      <p class="mb-8 text-muted-foreground">
        {{ $t('noAccess.description') }}
      </p>
      <Button variant="outline" @click="handleSignOut">
        {{ $t('sidebar.signOut') }}
      </Button>
    </div>
  </div>
</template>
