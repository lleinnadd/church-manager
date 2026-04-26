export default defineEventHandler(async (event) => {
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

  await safeDeleteAttachmentBlob(attachment.blobPath);
  await prisma.transactionAttachment.delete({ where: { id: attachmentId } });

  return { success: true };
});
