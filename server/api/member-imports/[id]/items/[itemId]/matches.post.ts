import { createError, defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { importDraftSchema } from '../../../../../../shared/validation/member-import';
import { getImportBatch, importContext, importId } from '../../../../../utils/member-import-access';
import { findImportMatches } from '../../../../../utils/member-import';
import prisma from '../../../../../utils/prisma';

export default defineEventHandler(async (event) => {
  const ctx = importContext(event);
  const batchId = importId(getRouterParam(event, 'id'));
  await getImportBatch(ctx, batchId);
  if (
    !(await prisma.memberImportItem.findFirst({
      where: { id: importId(getRouterParam(event, 'itemId')), batchId },
      select: { id: true },
    }))
  )
    throw createError({ statusCode: 404, statusMessage: 'Import unavailable' });
  const parsed = z
    .object({ values: importDraftSchema.shape.values, search: z.string().max(200).default('') })
    .strict()
    .safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid search' });
  return findImportMatches(ctx, parsed.data.values, prisma, parsed.data.search);
});
