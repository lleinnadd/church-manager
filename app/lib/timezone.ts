export const TIMEZONE_STORAGE_KEY = 'church-manager.timezone';
export const DEFAULT_FALLBACK_TIMEZONE = 'UTC';

const DEFAULT_TIMEZONE_OPTIONS = [
  'America/Sao_Paulo',
  'America/New_York',
  'Europe/London',
  'Europe/Lisbon',
  'UTC',
];

function parseOffsetToMinutes(value: string): number | null {
  if (value === 'GMT' || value === 'UTC') {
    return 0;
  }

  const match = value.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? '0');
  return sign * (hours * 60 + minutes);
}

export function getTimeZoneOffsetMinutes(timeZone: string, date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    });

    const offsetPart = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName');
    const parsed = offsetPart ? parseOffsetToMinutes(offsetPart.value) : null;
    if (parsed !== null) {
      return parsed;
    }
  } catch {
    return 0;
  }

  return 0;
}

export function formatTimeZoneOffsetCompact(timeZone: string, date: Date = new Date()): string {
  const minutes = getTimeZoneOffsetMinutes(timeZone, date);
  const sign = minutes < 0 ? '-' : '+';
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const remainderMinutes = absoluteMinutes % 60;

  if (remainderMinutes === 0) {
    return `${sign}${hours}`;
  }

  return `${sign}${hours}:${String(remainderMinutes).padStart(2, '0')}`;
}

export function formatCurrentTimeForTimeZone(
  timeZone: string,
  locale: string,
  date: Date = new Date(),
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '--:--';
  }
}

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
  return Array.from(new Set(merged)).sort((left, right) => {
    const offsetDifference = getTimeZoneOffsetMinutes(left) - getTimeZoneOffsetMinutes(right);
    if (offsetDifference !== 0) {
      return offsetDifference;
    }

    return left.localeCompare(right);
  });
}
