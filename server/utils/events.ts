import { EventSeriesType } from '@prisma/client';
import { z } from 'zod';

export const BRT_TIMEZONE = 'America/Sao_Paulo';
const BRT_UTC_OFFSET_MINUTES = 180;
export const DEFAULT_EVENT_DURATION_MINUTES = 120;

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function resolveEndMinutesFromStart(startMinutes: number): number {
  return startMinutes + DEFAULT_EVENT_DURATION_MINUTES;
}

export const eventDayScheduleSchema = z.object({
  date: z.string().min(1),
  startTime: z.string().regex(timePattern),
});

export const eventMonthlyRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  ordinal: z
    .number()
    .int()
    .min(-1)
    .max(4)
    .refine((value) => value !== 0),
  startTime: z.string().regex(timePattern),
});

export const eventSeriesSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    congregationId: z.string().min(1),
    departmentId: z.string().optional().nullable(),
    eventType: z.nativeEnum(EventSeriesType),
    startsOn: z.string().min(1),
    endsOn: z.string().optional().nullable(),
    sameTimeStart: z.string().optional().nullable(),
    daySchedules: z.array(eventDayScheduleSchema).optional().default([]),
    monthlyRule: eventMonthlyRuleSchema.optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.eventType === EventSeriesType.MULTI_DAY && !value.endsOn) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsOn'],
        message: 'endsOn is required for this event type',
      });
    }

    if (value.endsOn && value.endsOn < value.startsOn) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsOn'],
        message: 'endsOn must be greater than or equal to startsOn',
      });
    }

    const hasSameTime = Boolean(value.sameTimeStart);

    if (
      !hasSameTime &&
      !value.daySchedules?.length &&
      value.eventType !== EventSeriesType.MONTHLY_RECURRING
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sameTimeStart'],
        message: 'sameTimeStart is required for this event type',
      });
    }

    if (value.eventType === EventSeriesType.MONTHLY_RECURRING && !value.monthlyRule) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['monthlyRule'],
        message: 'monthlyRule is required for monthly recurring events',
      });
    }
  });

export type EventSeriesInput = z.infer<typeof eventSeriesSchema>;

export interface EventOccurrenceDraft {
  seriesId?: string;
  title: string;
  description: string | null;
  timezone: string;
  startAt: Date;
  endAt: Date;
  occurrenceDate: Date;
}

export interface EventSeriesDayScheduleLike {
  date: Date;
  startMinutes: number;
  endMinutes: number;
}

export interface EventSeriesLike {
  id: string;
  title: string;
  description: string | null;
  timezone: string;
  eventType: EventSeriesType;
  startsOn: Date;
  endsOn: Date | null;
  sameTimeStartMinutes: number | null;
  monthlyWeekday: number | null;
  monthlyOrdinal: number | null;
  daySchedules: EventSeriesDayScheduleLike[];
}

export function parseDateOnlyToUtc(dateString: string): Date {
  const [year = 1970, month = 1, day = 1] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function dateToDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toDateOnlyString(date: Date): string {
  return dateToDateOnlyString(date);
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 86400000);
}

function dateFromPartsUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

function combineDateAndMinutesBrt(day: Date, minutes: number): Date {
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();
  const date = day.getUTCDate();

  return new Date(
    Date.UTC(year, month, date, 0, 0, 0, 0) + (minutes + BRT_UTC_OFFSET_MINUTES) * 60000,
  );
}

function nthWeekdayDate(
  year: number,
  month: number,
  weekday: number,
  ordinal: number,
): Date | null {
  const firstDay = dateFromPartsUtc(year, month, 1);
  const firstWeekday = firstDay.getUTCDay();

  if (ordinal > 0) {
    const delta = (weekday - firstWeekday + 7) % 7;
    const dayOfMonth = 1 + delta + (ordinal - 1) * 7;
    const candidate = dateFromPartsUtc(year, month, dayOfMonth);
    if (candidate.getUTCMonth() !== month) return null;
    return candidate;
  }

  const lastDay = dateFromPartsUtc(year, month + 1, 0);
  const lastWeekday = lastDay.getUTCDay();
  const backwards = (lastWeekday - weekday + 7) % 7;
  const dayOfMonth = lastDay.getUTCDate() - backwards;
  const candidate = dateFromPartsUtc(year, month, dayOfMonth);
  if (candidate.getUTCMonth() !== month) return null;
  return candidate;
}

function overlapFilter(
  occurrence: EventOccurrenceDraft,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  return occurrence.startAt < rangeEnd && occurrence.endAt > rangeStart;
}

export function buildOccurrencesForSeriesRange(
  series: EventSeriesLike,
  rangeStart: Date,
  rangeEnd: Date,
): EventOccurrenceDraft[] {
  if (rangeEnd <= rangeStart) return [];

  const startsOn = parseDateOnlyToUtc(dateToDateOnlyString(series.startsOn));
  const effectiveEndsOn = (() => {
    if (series.endsOn) {
      return parseDateOnlyToUtc(dateToDateOnlyString(series.endsOn));
    }

    if (series.eventType === EventSeriesType.MONTHLY_RECURRING) {
      return null;
    }

    return startsOn;
  })();
  const rangeStartDate = parseDateOnlyToUtc(dateToDateOnlyString(rangeStart));
  const rangeEndDate = parseDateOnlyToUtc(dateToDateOnlyString(addDays(rangeEnd, -1)));
  const generationEndDate =
    effectiveEndsOn && effectiveEndsOn < rangeEndDate ? effectiveEndsOn : rangeEndDate;

  if (generationEndDate < startsOn) return [];

  const output: EventOccurrenceDraft[] = [];

  if (series.eventType === EventSeriesType.MONTHLY_RECURRING) {
    if (series.monthlyWeekday === null || series.monthlyOrdinal === null) return output;

    const startMinutes = series.sameTimeStartMinutes ?? 19 * 60;
    const endMinutes = resolveEndMinutesFromStart(startMinutes);

    const monthlyWindowStart = startsOn > rangeStartDate ? startsOn : rangeStartDate;
    if (generationEndDate < monthlyWindowStart) return output;

    let cursorYear = monthlyWindowStart.getUTCFullYear();
    let cursorMonth = monthlyWindowStart.getUTCMonth();

    const endYear = generationEndDate.getUTCFullYear();
    const endMonth = generationEndDate.getUTCMonth();

    while (cursorYear < endYear || (cursorYear === endYear && cursorMonth <= endMonth)) {
      const occurrenceDay = nthWeekdayDate(
        cursorYear,
        cursorMonth,
        series.monthlyWeekday,
        series.monthlyOrdinal,
      );

      if (
        occurrenceDay &&
        occurrenceDay >= monthlyWindowStart &&
        occurrenceDay <= generationEndDate
      ) {
        const occurrence: EventOccurrenceDraft = {
          seriesId: series.id,
          title: series.title,
          description: series.description?.trim() || null,
          timezone: series.timezone || BRT_TIMEZONE,
          startAt: combineDateAndMinutesBrt(occurrenceDay, startMinutes),
          endAt: combineDateAndMinutesBrt(occurrenceDay, endMinutes),
          occurrenceDate: parseDateOnlyToUtc(dateToDateOnlyString(occurrenceDay)),
        };

        if (overlapFilter(occurrence, rangeStart, rangeEnd)) {
          output.push(occurrence);
        }
      }

      if (cursorMonth === 11) {
        cursorYear += 1;
        cursorMonth = 0;
      } else {
        cursorMonth += 1;
      }
    }

    return output;
  }

  if (series.daySchedules?.length) {
    return series.daySchedules
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((entry) => {
        const day = parseDateOnlyToUtc(dateToDateOnlyString(entry.date));
        const occurrence: EventOccurrenceDraft = {
          seriesId: series.id,
          title: series.title,
          description: series.description?.trim() || null,
          timezone: series.timezone || BRT_TIMEZONE,
          startAt: combineDateAndMinutesBrt(day, entry.startMinutes),
          endAt: combineDateAndMinutesBrt(day, entry.endMinutes),
          occurrenceDate: day,
        };

        return occurrence;
      })
      .filter((occurrence) => {
        if (occurrence.occurrenceDate < startsOn) return false;
        if (effectiveEndsOn && occurrence.occurrenceDate > effectiveEndsOn) return false;
        return overlapFilter(occurrence, rangeStart, rangeEnd);
      });
  }

  const dailyWindowStart = startsOn > rangeStartDate ? startsOn : rangeStartDate;
  if (generationEndDate < dailyWindowStart) return output;

  const startMinutes = series.sameTimeStartMinutes ?? 19 * 60;
  const endMinutes = resolveEndMinutesFromStart(startMinutes);

  let cursor = dailyWindowStart;
  while (cursor <= generationEndDate) {
    const occurrence: EventOccurrenceDraft = {
      seriesId: series.id,
      title: series.title,
      description: series.description?.trim() || null,
      timezone: series.timezone || BRT_TIMEZONE,
      startAt: combineDateAndMinutesBrt(cursor, startMinutes),
      endAt: combineDateAndMinutesBrt(cursor, endMinutes),
      occurrenceDate: parseDateOnlyToUtc(dateToDateOnlyString(cursor)),
    };

    if (overlapFilter(occurrence, rangeStart, rangeEnd)) {
      output.push(occurrence);
    }

    cursor = addDays(cursor, 1);
  }

  return output;
}

export function buildOccurrenceDateKey(date: Date): string {
  return dateToDateOnlyString(parseDateOnlyToUtc(dateToDateOnlyString(date)));
}
