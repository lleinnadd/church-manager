<script setup lang="ts">
import { Languages } from 'lucide-vue-next';

const { $i18n } = useNuxtApp();

const currentLocale = computed(() => $i18n.locale.value);

const availableLocales = computed(() =>
  $i18n.locales.value.map((l: any) => (typeof l === 'string' ? { code: l, name: l } : l)),
);

async function switchLocale(code: string) {
  await $i18n.setLocale(code as 'en' | 'pt-BR');
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm">
        <Languages class="size-4" />
        <span class="sr-only">{{ $t('common.switchLanguage') }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        v-for="loc in availableLocales"
        :key="loc.code"
        :class="{ 'bg-accent': currentLocale === loc.code }"
        @click="switchLocale(loc.code)"
      >
        {{ loc.name }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
