<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue';

const { t } = useI18n();
const route = useRoute();

const sectionFallbacks: Record<string, string> = {
  members: '/members',
  departments: '/departments',
  congregations: '/congregations',
  events: '/events',
};

const topLevelSegment = computed(() => route.path.split('/').filter(Boolean)[0] ?? '');
const sectionFallback = computed<string>(() => {
  const segment = topLevelSegment.value;
  return sectionFallbacks[segment] ?? '/';
});
const isRoot = computed(() => route.path === '/');
const isSectionRoot = computed(() => {
  const fallback = sectionFallback.value;
  return fallback !== '/' && route.path === fallback;
});
const showBackButton = computed(() => !isRoot.value && !isSectionRoot.value);

async function handleBack() {
  await navigateTo(sectionFallback.value);
}
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="p-4 -mb-4 sticky top-0 z-50">
        <div
          role="header"
          class="flex h-14 shrink-0 items-center gap-3 rounded-lg border bg-card/80 px-4 shadow-sm backdrop-blur"
        >
          <SidebarTrigger
            class="-ml-1 h-8 w-8 rounded-md bg-muted/40 text-muted-foreground hover:bg-muted"
          />
          <Separator orientation="vertical" class="mr-1 h-4" />
          <Button
            v-if="showBackButton"
            variant="ghost"
            size="sm"
            class="h-8 rounded-md bg-muted/40 text-muted-foreground hover:bg-muted"
            @click="handleBack"
          >
            <ArrowLeft class="size-4" />
            <span>{{ t('common.back') }}</span>
          </Button>
          <div class="ml-auto">
            <SettingsMenu />
          </div>
        </div>
      </header>
      <div class="flex-1 px-4 pb-6 pt-4">
        <slot />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

<style lang="scss" scoped>
[role='header'] {
  box-shadow: 0px 0px 10px 10px var(--background);
}
</style>
