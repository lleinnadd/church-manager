import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'events', PermissionAction.CREATE);

  const parsed = eventSeriesSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }

  const body = parsed.data;
  const baseData = resolveEventSeriesBaseData(body);
  const daySchedulesData = mapEventSeriesDaySchedules(body.daySchedules);

  assertCongregationAccess(rbac, 'events', body.congregationId);

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

  const created = await prisma.eventSeries.create({
    data: {
      ...baseData,
      daySchedules: daySchedulesData.length
        ? {
            createMany: {
              data: daySchedulesData,
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
