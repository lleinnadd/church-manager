import { dark } from '@clerk/themes';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  devServer: { port: 3333 },
  vite: {
    optimizeDeps: {
      include: [
        '@clerk/vue',
        'class-variance-authority',
        '@internationalized/date',
        '@vee-validate/zod',
        'reka-ui',
        'reka-ui/date',
        '@prisma/client',
        'zod',
        '@clerk/themes',
      ],
    },
  },
  modules: [
    '@clerk/nuxt',
    '@nuxtjs/tailwindcss',
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxt/fonts',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
  ],
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'color-mode',
  },
  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'pt-BR', name: 'Português (Brasil)', file: 'pt-BR.json' },
    ],
    defaultLocale: 'pt-BR',
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
  },
  clerk: {
    skipServerMiddleware: true,
    signInUrl: '/auth/sign-in',
    signUpUrl: '/auth/sign-up',
    signInFallbackRedirectUrl: '/',
    signUpFallbackRedirectUrl: '/',
    appearance: {
      theme: dark,
    },
  },
  fonts: {
    families: [
      { name: 'Lato', provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    ],
  },
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
  components: [
    {
      path: '@/components',
      pathPrefix: false,
      ignore: ['ui/**/*'],
    },
  ],
  imports: {
    dirs: ['@/composables/**'],
  },
});
