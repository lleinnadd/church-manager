import { EventSeriesType, PermissionAction } from '@prisma/client';
import { z } from 'zod';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const querySchema = z.object({
  months: z
    .string()
    .transform((value) => value.split(','))
    .pipe(
      z
        .array(z.string().regex(/^\d{4}-\d{2}$/))
        .min(1)
        .max(12),
    ),
  congregationId: z.string().optional(),
  locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
  miniCalendars: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'events', PermissionAction.EXPORT);

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params' });
  }

  const { months: monthStrings, congregationId, locale, miniCalendars } = parsed.data;

  const monthParsed = monthStrings.map((m) => {
    const [yearStr, monthStr] = m.split('-');
    return { year: Number(yearStr), month: Number(monthStr) - 1 };
  });

  const sortedMonths = [...monthParsed].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
  );

  const firstMonth = sortedMonths[0]!;
  const lastMonth = sortedMonths[sortedMonths.length - 1]!;

  const extendedStart = new Date(Date.UTC(firstMonth.year, firstMonth.month - 1, 1, 0, 0, 0));
  const extendedEnd = new Date(Date.UTC(lastMonth.year, lastMonth.month + 2, 1, 0, 0, 0));

  const seriesList = await prisma.eventSeries.findMany({
    where: {
      startsOn: { lt: extendedEnd },
      OR: [
        { eventType: EventSeriesType.MONTHLY_RECURRING, endsOn: null },
        { endsOn: { gte: extendedStart } },
      ],
      congregationId: congregationId || undefined,
    },
    include: {
      daySchedules: { orderBy: { date: 'asc' } },
      congregation: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ startsOn: 'asc' }, { title: 'asc' }],
  });

  const dateStart = parseDateOnlyToUtc(extendedStart.toISOString().slice(0, 10));
  const queryEndForDate = new Date(extendedEnd.getTime() - 1);
  const dateEnd = parseDateOnlyToUtc(queryEndForDate.toISOString().slice(0, 10));

  const exceptionEntries = seriesList.length
    ? await prisma.eventOccurrence.findMany({
        where: {
          seriesId: { in: seriesList.map((s) => s.id) },
          isException: true,
          OR: [
            { occurrenceDate: { gte: dateStart, lte: dateEnd } },
            { startAt: { lt: extendedEnd }, endAt: { gt: extendedStart } },
          ],
          congregationId: congregationId || undefined,
        },
        include: {
          congregation: { select: { id: true, name: true } },
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
      })
    : [];

  const exceptionBySeriesAndDate = exceptionEntries.reduce((accumulator, entry) => {
    const key = `${entry.seriesId}:${buildOccurrenceDateKey(entry.occurrenceDate)}`;
    if (!accumulator.has(key)) {
      accumulator.set(key, entry);
    }
    return accumulator;
  }, new Map<string, (typeof exceptionEntries)[number]>());

  const consumedExceptions = new Set<string>();

  const allOccurrences = seriesList.flatMap((series) =>
    buildOccurrencesForSeriesRange(series, extendedStart, extendedEnd).flatMap((occurrence) => {
      const occurrenceKey = buildOccurrenceDateKey(occurrence.occurrenceDate);
      const key = `${series.id}:${occurrenceKey}`;
      const exception = exceptionBySeriesAndDate.get(key);

      if (exception) {
        consumedExceptions.add(exception.id);
        if (exception.cancelled) return [];
        return [
          {
            title: exception.title,
            startAt: exception.startAt,
            endAt: exception.endAt,
            eventType: exception.series.eventType,
            congregationName: exception.congregation?.name,
            departmentName: exception.department?.name,
          },
        ];
      }

      return [
        {
          title: occurrence.title,
          startAt: occurrence.startAt,
          endAt: occurrence.endAt,
          eventType: series.eventType,
          congregationName: series.congregation?.name,
          departmentName: series.department?.name,
        },
      ];
    }),
  );

  const remainingExceptions = exceptionEntries
    .filter(
      (ex) =>
        !consumedExceptions.has(ex.id) &&
        !ex.cancelled &&
        (!ex.series.endsOn || ex.occurrenceDate <= ex.series.endsOn) &&
        ex.startAt < extendedEnd &&
        ex.endAt > extendedStart,
    )
    .map((ex) => ({
      title: ex.title,
      startAt: ex.startAt,
      endAt: ex.endAt,
      eventType: ex.series.eventType,
      congregationName: ex.congregation?.name,
      departmentName: ex.department?.name,
    }));

  const events: CalendarEvent[] = [...allOccurrences, ...remainingExceptions].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  const monthsData: MonthData[] = sortedMonths.map(({ year, month }) => {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 1));
    const monthEvents = events.filter((e) => e.startAt >= monthStart && e.startAt < monthEnd);
    return { year, month, events: monthEvents };
  });

  const pdfBuffer = await renderCalendarPdf(monthsData, locale, BRT_TIMEZONE, events, {
    showMiniCalendars: miniCalendars,
  });

  const fileName =
    monthStrings.length === 1
      ? `calendario-${monthStrings[0]}.pdf`
      : `calendario-${monthStrings[0]}-a-${monthStrings[monthStrings.length - 1]}.pdf`;

  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-cache',
  });

  return pdfBuffer;
});
