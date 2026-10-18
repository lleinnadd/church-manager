import { createError, defineEventHandler, getRouterParam, readBody } from 'h3';
import { revisionSchema } from '../../../../../../shared/validation/member-import';
import { importContext, importId } from '../../../../../utils/member-import-access';
import { commitImportItem } from '../../../../../utils/member-import';

export default defineEventHandler(async (event) => {
  const parsed = revisionSchema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid revision' });
  return commitImportItem(
    importContext(event),
    importId(getRouterParam(event, 'id')),
    importId(getRouterParam(event, 'itemId')),
    parsed.data.revision,
  );
});
