import { useMediaQuery } from '@vueuse/core';

export type ColorMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'color-mode';

function isValidMode(value: string | null): value is ColorMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function useColorMode() {
  const mode = useState<ColorMode>('color-mode', () => 'system');
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  if (import.meta.client) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidMode(stored)) {
      mode.value = stored;
    }
  }

  const resolvedMode = computed<ColorMode>(() => {
    if (mode.value === 'system') {
      return prefersDark.value ? 'dark' : 'light';
    }
    return mode.value;
  });

  watch(
    mode,
    (value) => {
      if (!import.meta.client) return;
      localStorage.setItem(STORAGE_KEY, value);
    },
    { flush: 'post' },
  );

  return {
    mode,
    resolvedMode,
  };
}
