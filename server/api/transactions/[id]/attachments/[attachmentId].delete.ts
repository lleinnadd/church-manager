import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury', PermissionAction.UPDATE);

  const id = getRouterParam(event, 'id');
  const attachmentId = getRouterParam(event, 'attachmentId');

  if (!id || !attachmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Transaction id and attachment id are required',
    });
  }

  const attachment = await prisma.transactionAttachment.findFirst({
    where: { id: attachmentId, transactionId: id },
  });

  if (!attachment) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' });
  }

  const parentTransaction = await prisma.transaction.findUnique({
    where: { id },
    select: { congregationId: true },
  });
  assertCongregationAccess(rbac, 'treasury', parentTransaction?.congregationId);

  await safeDeleteAttachmentBlob(attachment.blobPath);
  await prisma.transactionAttachment.delete({ where: { id: attachmentId } });

  return { success: true };
});
