import { EventSeriesType } from '@prisma/client';
import {
  eventSeriesSchema,
  parseDateOnlyToUtc,
  parseTimeToMinutes,
  resolveEndMinutesFromStart,
} from '../../utils/events';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required' });
  }

  const parsed = eventSeriesSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const body = parsed.data;

  const existing = await prisma.eventSeries.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  const congregation = await prisma.congregation.findUnique({ where: { id: body.congregationId } });
  if (!congregation) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid congregationId' });
  }

  if (body.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: body.departmentId } });
    if (!department) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid departmentId' });
    }
  }

  const startsOn = parseDateOnlyToUtc(body.startsOn);
  if (body.eventType === EventSeriesType.MULTI_DAY && !body.endsOn) {
    throw createError({
      statusCode: 400,
      statusMessage: 'endsOn is required for multi-day events',
    });
  }

  const endsOn = (() => {
    if (body.eventType === EventSeriesType.SINGLE_DAY) {
      return startsOn;
    }

    if (body.eventType === EventSeriesType.MULTI_DAY) {
      return parseDateOnlyToUtc(body.endsOn as string);
    }

    return body.endsOn ? parseDateOnlyToUtc(body.endsOn) : null;
  })();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.eventSeriesDaySchedule.deleteMany({ where: { seriesId: id } });
    await tx.eventOccurrence.deleteMany({ where: { seriesId: id, isException: false } });

    const nextSeries = await tx.eventSeries.update({
      where: { id },
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        congregationId: body.congregationId,
        departmentId: body.departmentId || null,
        timezone: 'America/Sao_Paulo',
        eventType: body.eventType,
        startsOn,
        endsOn,
        sameTimeStartMinutes: (() => {
          if (body.eventType === EventSeriesType.MONTHLY_RECURRING) {
            return body.monthlyRule ? parseTimeToMinutes(body.monthlyRule.startTime) : null;
          }
          return body.sameTimeStart ? parseTimeToMinutes(body.sameTimeStart) : null;
        })(),
        monthlyWeekday: body.monthlyRule?.weekday ?? null,
        monthlyOrdinal: body.monthlyRule?.ordinal ?? null,
      },
    });

    if (body.daySchedules?.length) {
      await tx.eventSeriesDaySchedule.createMany({
        data: body.daySchedules.map((entry) => ({
          seriesId: id,
          date: parseDateOnlyToUtc(entry.date),
          startMinutes: parseTimeToMinutes(entry.startTime),
          endMinutes: resolveEndMinutesFromStart(parseTimeToMinutes(entry.startTime)),
        })),
      });
    }

    return nextSeries;
  });

  return updated;
});
