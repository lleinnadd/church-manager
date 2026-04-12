import { z } from 'zod';

const occurrenceSchema = z.object({
  seriesId: z.string().optional(),
  occurrenceDate: z.string().optional(),
  originalOccurrenceDate: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  cancelled: z.boolean().optional(),
});

function parseVirtualOccurrenceId(id: string): { seriesId: string; occurrenceDate: string } | null {
  const match = /^virtual:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (!match) return null;

  const seriesId = match[1];
  const occurrenceDate = match[2];
  if (!seriesId || !occurrenceDate) return null;

  return {
    seriesId,
    occurrenceDate,
  };
}

function normalizeOccurrenceDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return buildOccurrenceDateKey(parsed);
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Occurrence id is required' });
  }

  const parsed = occurrenceSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const body = parsed.data;

  const virtualInfo = parseVirtualOccurrenceId(id);

  const existingById = virtualInfo
    ? null
    : await prisma.eventOccurrence.findUnique({ where: { id } });

  const seriesId = body.seriesId || existingById?.seriesId || virtualInfo?.seriesId || undefined;

  const baseOccurrenceDateString =
    normalizeOccurrenceDateInput(body.originalOccurrenceDate || '') ||
    normalizeOccurrenceDateInput(body.occurrenceDate || '') ||
    (existingById ? buildOccurrenceDateKey(existingById.occurrenceDate) : undefined) ||
    virtualInfo?.occurrenceDate;

  if (!seriesId || !baseOccurrenceDateString) {
    throw createError({
      statusCode: 400,
      statusMessage: 'seriesId and occurrenceDate are required for exception updates',
    });
  }

  const baseOccurrenceDate = parseDateOnlyToUtc(baseOccurrenceDateString);

  const series = await prisma.eventSeries.findUnique({
    where: { id: seriesId },
    include: {
      daySchedules: { orderBy: { date: 'asc' } },
      congregation: { select: { id: true, name: true, type: true } },
      department: { select: { id: true, name: true } },
    },
  });

  if (!series) {
    throw createError({ statusCode: 404, statusMessage: 'Event series not found' });
  }

  const existingBySeriesAndDate = await prisma.eventOccurrence.findFirst({
    where: {
      seriesId,
      isException: true,
      occurrenceDate: baseOccurrenceDate,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const existing = existingById || existingBySeriesAndDate;

  const rangeStart = baseOccurrenceDate;
  const rangeEnd = new Date(baseOccurrenceDate.getTime() + 86400000);
  const baseOccurrence = buildOccurrencesForSeriesRange(series, rangeStart, rangeEnd).find(
    (entry) => buildOccurrenceDateKey(entry.occurrenceDate) === baseOccurrenceDateString,
  );

  const startAt = body.startAt
    ? new Date(body.startAt)
    : existing?.startAt || baseOccurrence?.startAt || null;
  const endAt = body.endAt
    ? new Date(body.endAt)
    : existing?.endAt || baseOccurrence?.endAt || null;

  if (!startAt || !endAt) {
    throw createError({ statusCode: 400, statusMessage: 'startAt and endAt are required' });
  }

  if (endAt <= startAt) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid occurrence time range' });
  }

  const payload = {
    seriesId,
    congregationId: series.congregationId,
    departmentId: series.departmentId,
    title: body.title ?? existing?.title ?? baseOccurrence?.title ?? series.title,
    description:
      body.description === undefined
        ? (existing?.description ?? baseOccurrence?.description ?? series.description)
        : body.description?.trim() || null,
    timezone: series.timezone,
    startAt,
    endAt,
    occurrenceDate: baseOccurrenceDate,
    cancelled: body.cancelled ?? existing?.cancelled ?? false,
    isException: true,
  };

  const saved = existing
    ? await prisma.eventOccurrence.update({
        where: { id: existing.id },
        data: payload,
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
      })
    : await prisma.eventOccurrence.create({
        data: payload,
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
      });

  return saved;
});
