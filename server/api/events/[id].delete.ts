import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'events', PermissionAction.DELETE);

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required' });
  }

  const existing = await prisma.eventSeries.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  assertCongregationAccess(rbac, 'events', existing.congregationId);

  await prisma.$transaction(async (tx) => {
    await tx.eventOccurrence.deleteMany({ where: { seriesId: id } });
    await tx.eventSeriesDaySchedule.deleteMany({ where: { seriesId: id } });
    await tx.eventSeries.delete({ where: { id } });
  });

  return { success: true };
});
