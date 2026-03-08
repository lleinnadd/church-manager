import { del, put } from '@vercel/blob';
import { imageSize } from 'image-size';

interface ImageDimensionResult {
  width?: number;
  height?: number;
}
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

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 400;

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
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'bin';
}

export function validateMemberPhotoBuffer(buffer: Buffer, mimeType: string) {
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported image type. Only PNG and WEBP are allowed',
    });
  }

  if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Image size must be at most 2MB' });
  }

  const resolveImageSize = imageSize as (input: Uint8Array) => ImageDimensionResult;
  const dimensions = resolveImageSize(buffer);
  const width = dimensions.width ?? 0;
  const height = dimensions.height ?? 0;

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image resolution must be at least 300x400',
    });
  }
}

export async function uploadMemberPhoto(buffer: Buffer, mimeType: string) {
  validateMemberPhotoBuffer(buffer, mimeType);

  const extension = extensionFromMimeType(mimeType);
  const pathname = `members/photos/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const uploadBlob = put as PutBlobFn;
  const blob = await uploadBlob(pathname, buffer, {
    access: 'public',
    contentType: mimeType,
    token: blobToken(),
    addRandomSuffix: false,
  });

  return { photoUrl: blob.url, photoBlobPath: blob.pathname };
}

export async function safeDeleteBlob(pathname: string) {
  try {
    const deleteBlob = del as DelBlobFn;
    await deleteBlob(pathname, { token: blobToken() });
  } catch {
    // no-op intentionally: member data changes should not fail because blob was already missing
  }
}
