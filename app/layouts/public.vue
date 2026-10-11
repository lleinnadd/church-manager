<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="container mx-auto">
      <header class="sticky top-0 z-50 p-4 -mb-4">
        <div
          class="flex h-14 items-center rounded-lg border bg-card/80 px-4 shadow-sm backdrop-blur"
        >
          <div class="ml-auto">
            <SettingsMenu />
          </div>
        </div>
      </header>
      <main class="px-4 pb-6 pt-4">
        <slot />
      </main>
    </div>
  </div>
</template>
