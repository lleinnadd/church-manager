export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Transaction id is required' });
  }

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction) {
    throw createError({ statusCode: 404, statusMessage: 'Transaction not found' });
  }

  const form = await readMultipartFormData(event);
  if (!form?.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one file is required' });
  }

  const fileParts = form.filter((part) => part.name === 'files');
  if (!fileParts.length) {
    throw createError({ statusCode: 400, statusMessage: 'No files found in request' });
  }

  const validParts = fileParts.filter((part) => part.data?.byteLength && part.type);

  const results = await Promise.all(
    validParts.map(async (filePart) => {
      const uploadResult = await uploadAttachment(
        filePart.data,
        filePart.type!,
        filePart.filename ?? 'attachment',
      );

      return prisma.transactionAttachment.create({
        data: {
          transactionId: id,
          fileName: uploadResult.fileName,
          fileType: uploadResult.fileType,
          fileSize: uploadResult.fileSize,
          blobPath: uploadResult.blobPath,
          blobUrl: uploadResult.blobUrl,
        },
      });
    }),
  );

  return results;
});
