import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'events', PermissionAction.READ);

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required' });
  }

  const series = await prisma.eventSeries.findUnique({
    where: { id },
    include: {
      daySchedules: { orderBy: { date: 'asc' } },
      congregation: { select: { id: true, name: true, type: true } },
      department: { select: { id: true, name: true } },
    },
  });

  if (!series) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  assertCongregationAccess(rbac, 'events', series.congregationId);

  return series;
});
