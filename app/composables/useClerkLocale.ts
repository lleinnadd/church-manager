import { ptBR } from '@clerk/localizations';

const clerkLocaleMap: Record<string, typeof ptBR | undefined> = {
  'pt-BR': ptBR,
};

export function useClerkLocale() {
  const { locale } = useI18n();
  const clerk = useClerk();

  watch(
    [locale, clerk],
    ([newLocale, clerkInstance]) => {
      if (!clerkInstance?.loaded) return;
      const localization = clerkLocaleMap[newLocale];
      updateClerkOptions({ localization });
    },
    { immediate: true },
  );
}
