<script setup lang="ts"></script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.treasury.settingsTitle') }}</h1>
        <p class="text-muted-foreground text-sm">{{ $t('pages.treasury.settingsDescription') }}</p>
      </div>
      <Button variant="outline" as-child>
        <NuxtLink to="/treasury">{{ $t('common.back') }}</NuxtLink>
      </Button>
    </div>

    <TreasuryConfigForm />
  </div>
</template>
