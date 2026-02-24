import { EventSeriesType } from '@prisma/client';
import { z } from 'zod';
import {
  buildOccurrenceDateKey,
  buildOccurrencesForSeriesRange,
  parseDateOnlyToUtc,
} from '../../utils/events';

const querySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  congregationId: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params' });
  }

  const now = new Date();
  const start = parsed.data.start
    ? new Date(parsed.data.start)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = parsed.data.end
    ? new Date(parsed.data.end)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

  const queryEndForDate = new Date(end.getTime() - 1);
  const dateStart = parseDateOnlyToUtc(start.toISOString().slice(0, 10));
  const dateEnd = parseDateOnlyToUtc(queryEndForDate.toISOString().slice(0, 10));

  const seriesList = await prisma.eventSeries.findMany({
    where: {
      startsOn: { lt: end },
      OR: [
        { eventType: EventSeriesType.MONTHLY_RECURRING, endsOn: null },
        { endsOn: { gte: start } },
      ],
      congregationId: parsed.data.congregationId || undefined,
    },
    include: {
      daySchedules: { orderBy: { date: 'asc' } },
      congregation: { select: { id: true, name: true, type: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ startsOn: 'asc' }, { title: 'asc' }],
  });

  if (!seriesList.length) {
    return [];
  }

  const exceptionEntries = await prisma.eventOccurrence.findMany({
    where: {
      seriesId: { in: seriesList.map((series) => series.id) },
      isException: true,
      OR: [
        {
          occurrenceDate: {
            gte: dateStart,
            lte: dateEnd,
          },
        },
        {
          startAt: { lt: end },
          endAt: { gt: start },
        },
      ],
      congregationId: parsed.data.congregationId || undefined,
    },
    include: {
      congregation: { select: { id: true, name: true, type: true } },
      department: { select: { id: true, name: true } },
      series: {
        select: {
          id: true,
          eventType: true,
          startsOn: true,
          endsOn: true,
          monthlyWeekday: true,
          monthlyOrdinal: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const exceptionBySeriesAndDate = exceptionEntries.reduce((accumulator, entry) => {
    const key = `${entry.seriesId}:${buildOccurrenceDateKey(entry.occurrenceDate)}`;
    if (!accumulator.has(key)) {
      accumulator.set(key, entry);
    }
    return accumulator;
  }, new Map<string, (typeof exceptionEntries)[number]>());

  const consumedExceptions = new Set<string>();

  const generatedAndMerged = seriesList.flatMap((series) =>
    buildOccurrencesForSeriesRange(series, start, end).flatMap((occurrence) => {
      const occurrenceKey = buildOccurrenceDateKey(occurrence.occurrenceDate);
      const key = `${series.id}:${occurrenceKey}`;
      const exception = exceptionBySeriesAndDate.get(key);

      if (exception) {
        consumedExceptions.add(exception.id);
        return exception.cancelled ? [] : [exception];
      }

      return [
        {
          id: `virtual:${series.id}:${occurrenceKey}`,
          seriesId: series.id,
          congregationId: series.congregationId,
          departmentId: series.departmentId,
          title: occurrence.title,
          description: occurrence.description,
          timezone: occurrence.timezone,
          startAt: occurrence.startAt,
          endAt: occurrence.endAt,
          occurrenceDate: occurrence.occurrenceDate,
          isException: false,
          cancelled: false,
          congregation: series.congregation,
          department: series.department,
          series: {
            id: series.id,
            eventType: series.eventType,
            startsOn: series.startsOn,
            endsOn: series.endsOn,
            monthlyWeekday: series.monthlyWeekday,
            monthlyOrdinal: series.monthlyOrdinal,
          },
        },
      ];
    }),
  );

  const remainingExceptions = exceptionEntries.filter(
    (exception) =>
      !consumedExceptions.has(exception.id) &&
      !exception.cancelled &&
      (!exception.series.endsOn || exception.occurrenceDate <= exception.series.endsOn) &&
      exception.startAt < end &&
      exception.endAt > start,
  );

  return [...generatedAndMerged, ...remainingExceptions].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );
});
