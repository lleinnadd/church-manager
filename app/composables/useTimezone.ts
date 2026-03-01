import {
  listTimeZoneOptions,
  normalizeTimeZone,
  resolveDeviceTimeZone,
  TIMEZONE_STORAGE_KEY,
} from '@/lib/timezone';

export function useTimezone() {
  const timezone = useState<string>('app-timezone', () => resolveDeviceTimeZone());

  const options = computed(() => listTimeZoneOptions());

  if (import.meta.client) {
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    const normalizedStored = normalizeTimeZone(stored);

    if (timezone.value !== normalizedStored) {
      timezone.value = normalizedStored;
    }

    watch(
      timezone,
      (value) => {
        localStorage.setItem(TIMEZONE_STORAGE_KEY, normalizeTimeZone(value));
      },
      { immediate: true },
    );
  }

  return {
    timezone,
    deviceTimezone: computed(() => resolveDeviceTimeZone()),
    options,
  };
}
