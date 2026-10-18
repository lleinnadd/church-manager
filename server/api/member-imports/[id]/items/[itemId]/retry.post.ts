import { createError, defineEventHandler, getRouterParam } from 'h3';
import prisma from '../../../../../utils/prisma';
import { getImportBatch, importContext, importId } from '../../../../../utils/member-import-access';
import { importEnabled } from '../../../../../utils/member-import-extraction';

export default defineEventHandler(async (event) => {
  const ctx = importContext(event);
  const batchId = importId(getRouterParam(event, 'id'));
  await getImportBatch(ctx, batchId);
  if (!importEnabled())
    throw createError({ statusCode: 503, statusMessage: 'Local extraction is disabled' });
  const result = await prisma.memberImportItem.updateMany({
    where: { id: importId(getRouterParam(event, 'itemId')), batchId, status: 'FAILED' },
    data: { status: 'UPLOADED', errorCode: null, revision: { increment: 1 } },
  });
  if (!result.count) throw createError({ statusCode: 409, statusMessage: 'Item changed' });
  return { success: true };
});
