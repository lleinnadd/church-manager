import { defineEventHandler } from 'h3';
import prisma from '../../utils/prisma';
import { importContext, canImportCongregation } from '../../utils/member-import-access';
import { importEnabled } from '../../utils/member-import-extraction';

export default defineEventHandler(async (event) => {
  const ctx = importContext(event);
  const batches = await prisma.memberImportBatch.findMany({
    where: { deleting: false, ...(ctx.isAdmin ? {} : { createdBy: ctx.clerkUserId }) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      congregationId: true,
      items: { select: { status: true, result: true } },
    },
  });
  const congregations = await prisma.congregation.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return {
    enabled: importEnabled(),
    batches: batches.filter((batch) => canImportCongregation(ctx, batch.congregationId)),
    congregations: congregations.filter((entry) => canImportCongregation(ctx, entry.id)),
  };
});
