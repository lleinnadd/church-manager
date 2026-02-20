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
