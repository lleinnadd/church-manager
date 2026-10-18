import { createError, defineEventHandler, getRouterParam, readBody } from 'h3';
import { draftRequestSchema } from '../../../../../shared/validation/member-import';
import { importContext, importId } from '../../../../utils/member-import-access';
import { saveImportDraft } from '../../../../utils/member-import';

export default defineEventHandler(async (event) => {
  const ctx = importContext(event);
  const parsed = draftRequestSchema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid draft' });
  return saveImportDraft(
    ctx,
    importId(getRouterParam(event, 'id')),
    importId(getRouterParam(event, 'itemId')),
    parsed.data.revision,
    parsed.data.draft,
  );
});
