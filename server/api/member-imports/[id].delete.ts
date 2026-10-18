import { defineEventHandler, getRouterParam } from 'h3';
import prisma from '../../utils/prisma';
import { getImportBatch, importContext, importId } from '../../utils/member-import-access';
import { removeImportDirectory } from '../../utils/member-import-files';

export default defineEventHandler(async (event) => {
  const ctx = importContext(event);
  const id = importId(getRouterParam(event, 'id'));
  await getImportBatch(ctx, id, true);
  // Persist the deletion intent first. Interrupted cleanup can be retried safely.
  await prisma.memberImportBatch.update({
    where: { id },
    data: { deleting: true, revision: { increment: 1 } },
  });
  await removeImportDirectory(id);
  await prisma.$transaction(async (tx) => {
    await tx.memberImportItem.deleteMany({ where: { batchId: id } });
    await tx.memberImportBatch.delete({ where: { id } });
  });
  return { success: true };
});
