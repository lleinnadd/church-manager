import { createError, defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { objectIdSchema } from '../../../shared/validation/member-import';
import prisma from '../../utils/prisma';
import { importContext, assertImportCongregation } from '../../utils/member-import-access';
import { importEnabled, extractionConfig } from '../../utils/member-import-extraction';

export default defineEventHandler(async (event) => {
  const ctx = importContext(event);
  if (!importEnabled())
    throw createError({ statusCode: 503, statusMessage: 'Local import is not enabled' });
  extractionConfig();
  const parsed = z
    .object({ congregationId: objectIdSchema })
    .strict()
    .safeParse(await readBody(event));
  if (!parsed.success)
    throw createError({ statusCode: 400, statusMessage: 'Choose a congregation' });
  assertImportCongregation(ctx, parsed.data.congregationId);
  if (
    !(await prisma.congregation.findUnique({
      where: { id: parsed.data.congregationId },
      select: { id: true },
    }))
  )
    throw createError({ statusCode: 400, statusMessage: 'Congregation unavailable' });
  return prisma.memberImportBatch.create({
    data: { createdBy: ctx.clerkUserId, congregationId: parsed.data.congregationId },
    select: { id: true },
  });
});
