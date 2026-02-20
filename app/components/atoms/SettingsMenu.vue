<script setup lang="ts">
import { Laptop, Moon, Settings, Sun } from 'lucide-vue-next';
import { useColorMode } from '@/composables/useColorMode';

const { t } = useI18n();
const { $i18n } = useNuxtApp();
const { mode } = useColorMode();

const currentLocale = computed(() => $i18n.locale.value);

type LocaleOption = string | { code: string; name: string };

const availableLocales = computed(() => {
  const locales = $i18n.locales.value as LocaleOption[];
  return locales.map((locale) =>
    typeof locale === 'string' ? { code: locale, name: locale } : locale,
  );
});

async function switchLocale(value: unknown) {
  if (typeof value !== 'string') return;
  await $i18n.setLocale(value as 'en' | 'pt-BR');
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-8 w-8 rounded-md bg-muted/40 text-muted-foreground hover:bg-muted"
      >
        <Settings class="size-4" />
        <span class="sr-only">{{ t('common.settings') }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-56 p-2">
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-medium text-muted-foreground">{{ t('common.theme') }}</span>
        <ToggleGroup v-model="mode" type="single" variant="outline" size="sm" :spacing="0">
          <ToggleGroupItem value="light" :aria-label="t('common.light')">
            <Sun class="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" :aria-label="t('common.dark')">
            <Moon class="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="system" :aria-label="t('common.system')">
            <Laptop class="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <DropdownMenuSeparator class="my-2" />
      <div class="grid gap-2">
        <span class="text-xs font-medium text-muted-foreground">{{ t('common.language') }}</span>
        <Select :model-value="currentLocale" @update:model-value="switchLocale">
          <SelectTrigger size="sm" class="w-full">
            <SelectValue :placeholder="t('common.language')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
              {{ loc.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
