<script setup lang="ts">
import { Laptop, Moon, Settings, Sun } from '@lucide/vue';
import { formatCurrentTimeForTimeZone, formatTimeZoneOffsetCompact } from '@/lib/timezone';

const { t } = useI18n();
const { $i18n } = useNuxtApp();
const { mode } = useThemeMode();
const { timezone, deviceTimezone, options: timezones } = useTimezone();

const currentLocale = computed(() => $i18n.locale.value);
const now = ref(new Date());

let timePreviewInterval: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  timePreviewInterval = setInterval(() => {
    now.value = new Date();
  }, 60_000);
});

onBeforeUnmount(() => {
  if (!timePreviewInterval) {
    return;
  }

  clearInterval(timePreviewInterval);
});

type LocaleOption = string | { code: string; name: string };

const availableLocales = computed(() => {
  const locales = $i18n.locales.value as LocaleOption[];
  return locales.map((locale) =>
    typeof locale === 'string' ? { code: locale, name: locale } : locale,
  );
});

const timezoneItems = computed(() =>
  timezones.value.map((item) => ({
    value: item,
    offsetLabel: formatTimeZoneOffsetCompact(item, now.value),
    currentTimeLabel: formatCurrentTimeForTimeZone(item, currentLocale.value, now.value),
  })),
);

async function switchLocale(value: unknown) {
  if (typeof value !== 'string') return;
  await $i18n.setLocale(value as 'en' | 'pt-BR');
}

function switchTimezone(value: unknown) {
  if (typeof value !== 'string') return;
  timezone.value = value;
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
      <DropdownMenuSeparator class="my-2" />
      <div class="grid gap-2">
        <span class="text-xs font-medium text-muted-foreground">{{ t('common.timezone') }}</span>
        <Select :model-value="timezone" @update:model-value="switchTimezone">
          <SelectTrigger size="sm" class="w-full">
            <SelectValue :placeholder="t('common.timezonePlaceholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="item in timezoneItems"
              :key="item.value"
              :value="item.value"
              :text-value="item.value"
            >
              <span class="flex min-w-0 items-center gap-2">
                <span class="truncate">{{ item.value }}</span>
                <span class="shrink-0 text-xs text-muted-foreground">
                  ({{ item.offsetLabel }}) · {{ item.currentTimeLabel }}
                </span>
              </span>
              <template #meta>
                <span
                  v-if="item.value === deviceTimezone"
                  class="ml-2 text-xs text-muted-foreground"
                >
                  ({{ t('common.deviceDefault') }})
                </span>
              </template>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
