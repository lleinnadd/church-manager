export type ColorMode = 'light' | 'dark' | 'system';

interface NuxtColorModeState {
  preference: string;
  value: string;
}

export function useThemeMode() {
  const colorMode = useNuxtApp().$colorMode as NuxtColorModeState;

  const mode = computed<ColorMode>({
    get() {
      return colorMode.preference === 'light' ||
        colorMode.preference === 'dark' ||
        colorMode.preference === 'system'
        ? colorMode.preference
        : 'system';
    },
    set(value) {
      colorMode.preference = value;
    },
  });

  const resolvedMode = computed<ColorMode>(() => (colorMode.value === 'dark' ? 'dark' : 'light'));

  return {
    mode,
    resolvedMode,
  };
}
