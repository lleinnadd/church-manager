import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'events', PermissionAction.UPDATE);

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required' });
  }

  const parsed = eventSeriesSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const body = parsed.data;
  const baseData = resolveEventSeriesBaseData(body);
  const daySchedulesData = mapEventSeriesDaySchedules(body.daySchedules);

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

  const updated = await prisma.$transaction(async (tx) => {
    await tx.eventSeriesDaySchedule.deleteMany({ where: { seriesId: id } });
    await tx.eventOccurrence.deleteMany({ where: { seriesId: id, isException: false } });

    const nextSeries = await tx.eventSeries.update({
      where: { id },
      data: {
        ...baseData,
      },
    });

    if (daySchedulesData.length) {
      await tx.eventSeriesDaySchedule.createMany({
        data: daySchedulesData.map((entry) => ({
          seriesId: id,
          date: entry.date,
          startMinutes: entry.startMinutes,
          endMinutes: entry.endMinutes,
        })),
      });
    }

    return nextSeries;
  });

  return updated;
});
