export const TIMEZONE_STORAGE_KEY = 'church-manager.timezone';
export const DEFAULT_FALLBACK_TIMEZONE = 'UTC';

const DEFAULT_TIMEZONE_OPTIONS = [
  'America/Sao_Paulo',
  'America/New_York',
  'Europe/London',
  'Europe/Lisbon',
  'UTC',
];

function hasValidIntlTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveDeviceTimeZone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (detected && hasValidIntlTimeZone(detected)) {
    return detected;
  }

  return DEFAULT_FALLBACK_TIMEZONE;
}

export function normalizeTimeZone(value?: string | null): string {
  if (!value) {
    return resolveDeviceTimeZone();
  }

  return hasValidIntlTimeZone(value) ? value : resolveDeviceTimeZone();
}

export function listTimeZoneOptions(): string[] {
  const dynamic = (() => {
    if (typeof Intl.supportedValuesOf !== 'function') {
      return [];
    }

    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [];
    }
  })();

  const merged = [...DEFAULT_TIMEZONE_OPTIONS, resolveDeviceTimeZone(), ...dynamic];
  return Array.from(new Set(merged)).sort((left, right) => left.localeCompare(right));
}
