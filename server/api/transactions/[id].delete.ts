import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury', PermissionAction.DELETE);

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Transaction id is required' });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { attachments: true },
  });

  if (!transaction) {
    throw createError({ statusCode: 404, statusMessage: 'Transaction not found' });
  }

  assertCongregationAccess(rbac, 'treasury', transaction.congregationId);

  const deletePromises = transaction.attachments.map((attachment) =>
    safeDeleteAttachmentBlob(attachment.blobPath),
  );
  await Promise.all(deletePromises);

  await prisma.transactionAttachment.deleteMany({ where: { transactionId: id } });
  await prisma.transaction.delete({ where: { id } });

  return { success: true };
});
