import { dark } from '@clerk/themes';
import { createRequire } from 'node:module';
import path from 'node:path';

const esmRequire = createRequire(import.meta.url);
const prismaClientDir = path.dirname(esmRequire.resolve('@prisma/client/package.json'));
const prismaClientBrowserPath = path.resolve(
  prismaClientDir,
  '../../.prisma/client/index-browser.js',
);

export default defineNuxtConfig({
  compatibilityDate: '2026-07-26',
  devtools: { enabled: true },
  devServer: { port: 3333 },
  typescript: {
    typeCheck: false,
  },
  sourcemap: {
    server: false,
    client: false,
  },
  vite: {
    resolve: {
      alias: {
        '.prisma/client/index-browser': prismaClientBrowserPath,
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          if (
            warning.code === 'UNRESOLVED_IMPORT' &&
            typeof warning.exporter === 'string' &&
            warning.exporter.includes('.prisma/client')
          )
            return;
          defaultHandler(warning);
        },
      },
    },
    plugins: [
      {
        name: 'suppress-sourcemap-warnings',
        configResolved(config) {
          const originalWarn = config.logger.warn.bind(config.logger);
          config.logger.warn = (msg, options) => {
            if (typeof msg === 'string' && msg.includes('Sourcemap is likely to be incorrect'))
              return;
            originalWarn(msg, options);
          };
        },
      },
    ],
    optimizeDeps: {
      include: [
        'class-variance-authority',
        '@internationalized/date',
        '@vee-validate/zod',
        'reka-ui',
        'reka-ui/date',
        '@prisma/client',
        'zod',
        '@clerk/themes',
        '@clerk/localizations',
        '@fullcalendar/vue3',
        '@fullcalendar/daygrid',
        '@fullcalendar/core/locales/pt-br',
        '@fullcalendar/core/locales/en-gb',
        '@fullcalendar/interaction',
        'vee-validate',
        '@lucide/vue',
        'vue-sonner',
        'clsx',
        'tailwind-merge',
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
    function stripVolarPlugin(_options, nuxt) {
      nuxt.hook('prepare:types', ({ tsConfig, nodeTsConfig: nodeConfig }) => {
        tsConfig.vueCompilerOptions ||= {};
        const plugins: string[] = [];
        const origPush = plugins.push.bind(plugins);
        (plugins as { push: typeof origPush }).push = (...items: string[]) => {
          const filtered = items.filter((i) => !String(i).includes('sfc-route-blocks'));
          return origPush(...filtered);
        };
        tsConfig.vueCompilerOptions.plugins = plugins;

        nodeConfig.include ||= [];
        nodeConfig.include.push(
          '../eslint.config.ts',
          '../commitlint.config.ts',
          '../prisma.config.ts',
        );
      });
    },
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
  hooks: {
    'vite:extendConfig': function dedupeVueTsc(config, { isServer }) {
      if (isServer && config.plugins) {
        const idx = (config.plugins as unknown[]).findIndex(
          (p) => p && typeof (p as { then?: unknown }).then === 'function',
        );
        if (idx !== -1) {
          (config.plugins as unknown[]).splice(idx, 1);
        }
      }
    },
  },
});
