<script setup lang="ts">
import { Languages } from '@lucide/vue';

const { $i18n } = useNuxtApp();

const currentLocale = computed(() => $i18n.locale.value);

type LocaleOption = string | { code: string; name: string };

const availableLocales = computed(() => {
  const locales = $i18n.locales.value as LocaleOption[];
  return locales.map((locale) =>
    typeof locale === 'string' ? { code: locale, name: locale } : locale,
  );
});

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
