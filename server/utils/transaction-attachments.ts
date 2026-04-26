import { del, put } from '@vercel/blob';

type PutBlobFn = (
  pathname: string,
  body: Buffer,
  options: {
    access: 'public';
    contentType: string;
    token: string;
    addRandomSuffix: false;
  },
) => Promise<{ url: string; pathname: string }>;
type DelBlobFn = (pathname: string, options: { token: string }) => Promise<void>;

const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw createError({
      statusCode: 500,
      statusMessage: 'BLOB_READ_WRITE_TOKEN is not configured',
    });
  }
  return token;
}

function extensionFromMimeType(mimeType: string) {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimeType] ?? 'bin';
}

export function validateAttachmentFile(buffer: Buffer, mimeType: string) {
  if (!ALLOWED_FILE_TYPES.has(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported file type. Only PDF, JPG, PNG and WEBP are allowed',
    });
  }

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File size must be at most 5MB',
    });
  }
}

export async function uploadAttachment(buffer: Buffer, mimeType: string, originalName: string) {
  validateAttachmentFile(buffer, mimeType);

  const extension = extensionFromMimeType(mimeType);
  const pathname = `treasury/attachments/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const uploadBlob = put as PutBlobFn;
  const blob = await uploadBlob(pathname, buffer, {
    access: 'public',
    contentType: mimeType,
    token: blobToken(),
    addRandomSuffix: false,
  });

  return {
    blobUrl: blob.url,
    blobPath: blob.pathname,
    fileName: originalName,
    fileType: mimeType,
    fileSize: buffer.byteLength,
  };
}

export async function safeDeleteAttachmentBlob(pathname: string) {
  try {
    const deleteBlob = del as DelBlobFn;
    await deleteBlob(pathname, { token: blobToken() });
  } catch {
    // no-op: blob may already be missing
  }
}
