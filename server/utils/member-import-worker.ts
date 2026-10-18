import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { extractImportImage, extractionConfig } from './member-import-extraction';
import { initialImportDraft } from './member-import';

export async function processNextImport(extractor = extractImportImage) {
  const now = new Date();
  await prisma.memberImportItem.updateMany({
    where: { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
    data: {
      status: 'UPLOADED',
      leaseToken: null,
      leaseExpiresAt: null,
      revision: { increment: 1 },
    },
  });
  const item = await prisma.memberImportItem.findFirst({
    where: { status: 'UPLOADED', batch: { deleting: false } },
    orderBy: { createdAt: 'asc' },
    include: { batch: true },
  });
  if (!item) return false;
  const leaseToken = randomUUID();
  const { timeoutMs } = extractionConfig();
  const claimed = await prisma.memberImportItem.updateMany({
    where: { id: item.id, status: 'UPLOADED', revision: item.revision },
    data: {
      status: 'PROCESSING',
      leaseToken,
      leaseExpiresAt: new Date(Date.now() + timeoutMs + 60000),
      attempts: { increment: 1 },
      revision: { increment: 1 },
    },
  });
  if (!claimed.count) return false;
  try {
    const extraction = await extractor(item.previewPath);
    await prisma.memberImportItem.updateMany({
      where: { id: item.id, status: 'PROCESSING', leaseToken },
      data: {
        status: 'REVIEW_READY',
        extraction: JSON.parse(JSON.stringify(extraction)) as Prisma.InputJsonValue,
        draft: JSON.parse(
          JSON.stringify(initialImportDraft(extraction, item.batch.congregationId)),
        ) as Prisma.InputJsonValue,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode: null,
        revision: { increment: 1 },
      },
    });
  } catch (error) {
    let code = 'EXTRACTION_FAILED';
    if (error instanceof Error && error.name === 'TimeoutError') code = 'EXTRACTION_TIMEOUT';
    else if (error instanceof Error && error.message === 'MODEL_NOT_AVAILABLE')
      code = 'MODEL_NOT_AVAILABLE';
    await prisma.memberImportItem.updateMany({
      where: { id: item.id, status: 'PROCESSING', leaseToken },
      data: {
        status: 'FAILED',
        errorCode: code,
        leaseToken: null,
        leaseExpiresAt: null,
        revision: { increment: 1 },
      },
    });
  }
  return true;
}
