import { defineEventHandler, getRouterParam } from 'h3';
import { importContext, importId } from '../../utils/member-import-access';
import { readImportBatch } from '../../utils/member-import';

export default defineEventHandler((event) =>
  readImportBatch(importContext(event), importId(getRouterParam(event, 'id'))),
);
