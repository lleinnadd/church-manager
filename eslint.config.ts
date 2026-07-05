import eslint from '@eslint/js';
import { configs, plugins } from 'eslint-config-airbnb-extended';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';
import type { Linter } from 'eslint';

function withVueFiles(cfgs: Linter.Config[]): Linter.Config[] {
  return cfgs.map((cfg) => {
    if (cfg.files) {
      return { ...cfg, files: [...cfg.files, '**/*.vue'] };
    }
    return cfg;
  });
}

export default typescriptEslint.config(
  {
    ignores: [
      'node_modules/',
      '.nuxt/',
      '.output/',
      'dist/',
      '**/*.d.ts',
      'eslint.config.ts',
      'commitlint.config.ts',
      'prisma.config.ts',
      'prisma/seed.ts',
    ],
  },

  ...withVueFiles([plugins.importX, plugins.stylistic]),

  eslint.configs.recommended,

  ...withVueFiles(configs.base.recommended),
  ...withVueFiles(configs.base.typescript),

  ...withVueFiles(typescriptEslint.configs.recommended),

  ...eslintPluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptEslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  {
    languageOptions: {
      globals: {
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
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        defineSlots: 'readonly',
        defineModel: 'readonly',
        defineOptions: 'readonly',
        withDefaults: 'readonly',
        useRoute: 'readonly',
        useRouter: 'readonly',
        navigateTo: 'readonly',
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
        useRequestFetch: 'readonly',
        useRequestEvent: 'readonly',
        useRequestURL: 'readonly',
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

  {
    rules: {
      'import-x/no-unresolved': 'off',
      'import-x/no-extraneous-dependencies': 'off',
      'import-x/prefer-default-export': 'off',
      'import-x/extensions': 'off',
      'import-x/no-cycle': 'off',

      'no-param-reassign': [
        'error',
        {
          props: true,
          ignorePropertyModificationsFor: [
            'state',
            'acc',
            'e',
            'ctx',
            'req',
            'res',
            'event',
            'config',
            'tsConfig',
            'nodeConfig',
          ],
        },
      ],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'warn',

      'vue/multi-word-component-names': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/require-default-prop': 'off',
    },
  },

  eslintPluginPrettierRecommended,

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

  {
    files: ['server/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-continue': 'off',
      'no-underscore-dangle': [
        'error',
        {
          allow: ['_count', '_all', '_sum', '_avg', '_min', '_max'],
        },
      ],
    },
  },
);
