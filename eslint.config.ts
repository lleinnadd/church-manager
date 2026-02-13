import eslint from '@eslint/js';
import { configs, plugins } from 'eslint-config-airbnb-extended';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';
import type { Linter } from 'eslint';

/**
 * Extends each config object's `files` array to also include `**\/*.vue`,
 * so that the Airbnb rules apply inside Vue single-file component scripts.
 */
function withVueFiles(cfgs: Linter.Config[]): Linter.Config[] {
  return cfgs.map((cfg) => {
    if (cfg.files) {
      return { ...cfg, files: [...cfg.files, '**/*.vue'] };
    }
    return cfg;
  });
}

export default typescriptEslint.config(
  // ── Global ignores ────────────────────────────────────────────────────
  {
    ignores: ['node_modules/', '.nuxt/', '.output/', 'dist/', '**/*.d.ts', 'eslint.config.ts'],
  },

  // ── Register plugins used by airbnb-extended configs ──────────────────
  // Each plugin export is a flat config object that registers the plugin
  // namespace. We extend their file patterns to include .vue files.
  ...withVueFiles([plugins.importX, plugins.stylistic, plugins.typescriptEslint]),

  // ── ESLint core recommended rules ─────────────────────────────────────
  eslint.configs.recommended,

  // ── Airbnb base rules (JS + TS) with Vue file support ─────────────────
  ...withVueFiles(configs.base.recommended),
  ...withVueFiles(configs.base.typescript),

  // ── Vue recommended rules ─────────────────────────────────────────────
  ...eslintPluginVue.configs['flat/recommended'],

  // ── TypeScript language settings for TS & Vue files ───────────────────
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        parser: typescriptEslint.parser,
        projectService: true,
        // Available in Node 20.11+ / jiti; not in Nuxt's tsconfig scope.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error — import.meta.dirname works at runtime
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },

  // ── Nuxt auto-import globals ──────────────────────────────────────────
  // Prevents no-undef errors for Nuxt/Vue auto-imported APIs.
  {
    languageOptions: {
      globals: {
        // Vue reactivity & lifecycle
        ref: 'readonly',
        computed: 'readonly',
        reactive: 'readonly',
        watch: 'readonly',
        watchEffect: 'readonly',
        onMounted: 'readonly',
        onUnmounted: 'readonly',
        onBeforeMount: 'readonly',
        onBeforeUnmount: 'readonly',
        onBeforeUpdate: 'readonly',
        onUpdated: 'readonly',
        onErrorCaptured: 'readonly',
        onActivated: 'readonly',
        onDeactivated: 'readonly',
        onServerPrefetch: 'readonly',
        nextTick: 'readonly',
        toRef: 'readonly',
        toRefs: 'readonly',
        toValue: 'readonly',
        unref: 'readonly',
        isRef: 'readonly',
        isReactive: 'readonly',
        isReadonly: 'readonly',
        shallowRef: 'readonly',
        shallowReactive: 'readonly',
        triggerRef: 'readonly',
        customRef: 'readonly',
        readonly: 'readonly',
        provide: 'readonly',
        inject: 'readonly',
        h: 'readonly',
        // Vue macros
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        defineSlots: 'readonly',
        defineModel: 'readonly',
        defineOptions: 'readonly',
        withDefaults: 'readonly',
        // Vue Router
        useRoute: 'readonly',
        useRouter: 'readonly',
        navigateTo: 'readonly',
        // Nuxt composables
        useAsyncData: 'readonly',
        useFetch: 'readonly',
        useLazyFetch: 'readonly',
        useLazyAsyncData: 'readonly',
        useHead: 'readonly',
        useSeoMeta: 'readonly',
        useNuxtApp: 'readonly',
        useRuntimeConfig: 'readonly',
        useState: 'readonly',
        useCookie: 'readonly',
        useError: 'readonly',
        useRequestHeaders: 'readonly',
        useRequestEvent: 'readonly',
        useRequestURL: 'readonly',
        // Nuxt utilities
        defineNuxtConfig: 'readonly',
        defineNuxtPlugin: 'readonly',
        defineNuxtRouteMiddleware: 'readonly',
        definePageMeta: 'readonly',
        defineAppConfig: 'readonly',
        createError: 'readonly',
        showError: 'readonly',
        clearError: 'readonly',
        clearNuxtData: 'readonly',
        refreshNuxtData: 'readonly',
        setPageLayout: 'readonly',
        abortNavigation: 'readonly',
        addRouteMiddleware: 'readonly',
        preloadComponents: 'readonly',
        prefetchComponents: 'readonly',
        callOnce: 'readonly',
      },
    },
  },

  // ── Rule overrides ────────────────────────────────────────────────────
  {
    rules: {
      // ── Import rules ────────────────────────────────────────────────────
      // TypeScript already catches unresolved imports; disable to avoid
      // false positives with Nuxt aliases (@ / ~ / #).
      'import-x/no-unresolved': 'off',
      'import-x/no-extraneous-dependencies': 'off',
      'import-x/prefer-default-export': 'off',
      'import-x/extensions': 'off',
      // Nuxt auto-imports cause false-positive cycle detections.
      'import-x/no-cycle': 'off',

      // ── Core JS overrides ───────────────────────────────────────────────
      'no-param-reassign': [
        'error',
        {
          props: true,
          ignorePropertyModificationsFor: ['state', 'acc', 'e', 'ctx', 'req', 'res'],
        },
      ],
      // TypeScript handles unused vars better
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Allow console in dev (warn instead of error)
      'no-console': 'warn',

      // ── Vue overrides ───────────────────────────────────────────────────
      'vue/multi-word-component-names': 'off',
      'vue/no-multiple-template-root': 'off',
      // Vue+TS defineProps with generics handles defaults differently.
      'vue/require-default-prop': 'off',
    },
  },

  // ── Prettier (MUST be last) ───────────────────────────────────────────
  // Disables all formatting rules that conflict with Prettier and
  // runs Prettier as an ESLint rule via eslint-plugin-prettier.
  eslintPluginPrettierRecommended,

  // ── Relax strict rules for shadcn-ui generated components ─────────────
  {
    files: ['app/components/ui/**/*.{ts,vue}'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-plusplus': 'off',
      'consistent-return': 'off',
      'symbol-description': 'off',
      'no-param-reassign': 'off',
      '@typescript-eslint/no-shadow': 'off',
    },
  },
);
