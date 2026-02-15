<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex items-center justify-end p-4">
      <LanguageSwitcher />
    </header>
    <div class="flex flex-1 items-center justify-center">
      <slot />
    </div>
  </div>
</template>
