import { Prisma } from '@prisma/client';
import {
  createError,
  defineEventHandler,
  getHeader,
  getRouterParam,
  readMultipartFormData,
} from 'h3';
import prisma from '../../../utils/prisma';
import { getImportBatch, importContext, importId } from '../../../utils/member-import-access';
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ITEMS,
  removeImportImage,
  storeImportImage,
} from '../../../utils/member-import-files';

export default defineEventHandler(async (event) => {
  const ctx = importContext(event);
  const batchId = importId(getRouterParam(event, 'id'));
  await getImportBatch(ctx, batchId);
  const length = Number(getHeader(event, 'content-length') || 0);
  if (!length || length > MAX_IMPORT_BYTES + 65536)
    throw createError({
      statusCode: 413,
      statusMessage: 'Upload one image at a time, up to 15 MB',
    });
  const form = await readMultipartFormData(event);
  const files = form?.filter((part) => part.name === 'file' && part.filename);
  if (files?.length !== 1)
    throw createError({ statusCode: 400, statusMessage: 'Upload one image at a time' });
  const file = files[0]!;
  const stored = await storeImportImage(batchId, file.data);
  try {
    return await prisma.$transaction(async (tx) => {
      const batch = await tx.memberImportBatch.updateMany({
        where: { id: batchId, deleting: false },
        data: { revision: { increment: 1 } },
      });
      if (!batch.count) throw createError({ statusCode: 409, statusMessage: 'Import changed' });
      if ((await tx.memberImportItem.count({ where: { batchId } })) >= MAX_IMPORT_ITEMS)
        throw createError({
          statusCode: 400,
          statusMessage: 'A batch can contain at most 20 forms',
        });
      return tx.memberImportItem.create({
        data: { batchId, fileName: file.filename!.split(/[\\/]/).pop()!.slice(0, 255), ...stored },
        select: { id: true },
      });
    });
  } catch (error) {
    await removeImportImage(stored);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw createError({ statusCode: 409, statusMessage: 'This image is already in this batch' });
    throw error;
  }
});
