import { readFile } from 'node:fs/promises';
import { createError, defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3';
import prisma from '../../../../../utils/prisma';
import { getImportBatch, importContext, importId } from '../../../../../utils/member-import-access';
import { importFilePath } from '../../../../../utils/member-import-files';

export default defineEventHandler(async (event) => {
  const ctx = importContext(event);
  const batchId = importId(getRouterParam(event, 'id'));
  await getImportBatch(ctx, batchId);
  const item = await prisma.memberImportItem.findFirst({
    where: { id: importId(getRouterParam(event, 'itemId')), batchId },
  });
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Source unavailable' });
  const original = getQuery(event).original === 'true';
  setHeader(event, 'Cache-Control', 'private, no-store');
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'Content-Type', original ? item.sourceType : 'image/jpeg');
  if (original)
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="form.${item.sourcePath.split('.').pop()}"`,
    );
  try {
    return await readFile(importFilePath(original ? item.sourcePath : item.previewPath));
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Local source unavailable' });
  }
});
