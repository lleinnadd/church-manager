import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'members', PermissionAction.UPDATE);

  const form = await readMultipartFormData(event);
  const filePart = form?.find((part) => part.name === 'file');

  if (!filePart?.data?.byteLength) {
    throw createError({ statusCode: 400, statusMessage: 'Photo file is required' });
  }

  if (!filePart.type) {
    throw createError({ statusCode: 400, statusMessage: 'Photo mime type is required' });
  }

  const { photoUrl, photoBlobPath } = await uploadMemberPhoto(filePart.data, filePart.type);

  return {
    photoUrl,
    photoBlobPath,
  };
});
