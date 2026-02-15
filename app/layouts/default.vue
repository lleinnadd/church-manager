<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
        <Separator orientation="vertical" class="mr-2 h-4" />
        <div class="ml-auto">
          <LanguageSwitcher />
        </div>
      </header>
      <div class="flex-1 p-4">
        <slot />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
