import { EventSeriesType } from '@prisma/client';
import {
  eventSeriesSchema,
  parseDateOnlyToUtc,
  parseTimeToMinutes,
  resolveEndMinutesFromStart,
} from '../../utils/events';

export default defineEventHandler(async (event) => {
  const parsed = eventSeriesSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const body = parsed.data;

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

  const created = await prisma.eventSeries.create({
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
      daySchedules: body.daySchedules?.length
        ? {
            createMany: {
              data: body.daySchedules.map((entry) => ({
                date: parseDateOnlyToUtc(entry.date),
                startMinutes: parseTimeToMinutes(entry.startTime),
                endMinutes: resolveEndMinutesFromStart(parseTimeToMinutes(entry.startTime)),
              })),
            },
          }
        : undefined,
    },
    include: {
      daySchedules: { orderBy: { date: 'asc' } },
      occurrences: { where: { cancelled: false }, orderBy: { startAt: 'asc' } },
      congregation: { select: { id: true, name: true, type: true } },
      department: { select: { id: true, name: true } },
    },
  });

  return created;
});
