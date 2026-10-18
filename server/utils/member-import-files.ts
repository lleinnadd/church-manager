import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import { createError } from 'h3';
import { imageSize } from 'image-size';

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
export const MAX_IMPORT_ITEMS = 20;
export const importStorageRoot = () =>
  resolve(process.env.MEMBER_IMPORT_STORAGE_DIR || '.data/member-imports');
export function importFilePath(relative: string) {
  if (!/^[a-f\d]{24}\/[a-f\d-]+(?:-preview)?\.(jpg|png|webp|heic)$/i.test(relative))
    throw new Error('Invalid import storage path');
  return join(importStorageRoot(), relative);
}
export function detectImportImage(data: Buffer) {
  if (!data.length || data.length > MAX_IMPORT_BYTES)
    throw createError({ statusCode: 400, statusMessage: 'Image must be at most 15 MB' });
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { extension: 'png', type: 'image/png' };
  if (data[0] === 255 && data[1] === 216 && data[2] === 255)
    return { extension: 'jpg', type: 'image/jpeg' };
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP')
    return { extension: 'webp', type: 'image/webp' };
  if (
    data.toString('ascii', 4, 8) === 'ftyp' &&
    /heic|heix|hevc|hevx/.test(data.toString('ascii', 8, 32))
  )
    return { extension: 'heic', type: 'image/heic' };
  throw createError({ statusCode: 400, statusMessage: 'Use HEIC, JPEG, PNG or WebP images' });
}
export async function removeImportImage(paths: { sourcePath: string; previewPath: string }) {
  await Promise.all(
    [paths.sourcePath, paths.previewPath].map((path) => rm(importFilePath(path), { force: true })),
  );
}
export async function storeImportImage(batchId: string, data: Buffer) {
  const { extension, type } = detectImportImage(data);
  const id = randomUUID();
  const sourcePath = `${batchId}/${id}.${extension}`;
  const previewPath = `${batchId}/${id}-preview.jpg`;
  await mkdir(join(importStorageRoot(), batchId), { recursive: true, mode: 0o700 });
  await writeFile(importFilePath(sourcePath), data, { mode: 0o600, flag: 'wx' });
  try {
    // macOS ImageIO handles HEIC and orientation locally. No shell interpolation.
    await promisify(execFile)(
      '/usr/bin/sips',
      [
        '-s',
        'format',
        'jpeg',
        '-Z',
        '3072',
        importFilePath(sourcePath),
        '--out',
        importFilePath(previewPath),
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
    );
    const preview = await readFile(importFilePath(previewPath));
    const dimensions = imageSize(preview);
    if (!dimensions.width || !dimensions.height) throw new Error('Image decode failed');
    await chmod(importFilePath(previewPath), 0o600);
    return {
      sourcePath,
      previewPath,
      sourceType: type,
      sourceHash: createHash('sha256').update(data).digest('hex'),
    };
  } catch {
    await removeImportImage({ sourcePath, previewPath });
    throw createError({
      statusCode: 400,
      statusMessage: 'Image could not be decoded locally. Check macOS sips and the file.',
    });
  }
}
export async function removeImportDirectory(batchId: string) {
  if (!/^[a-f\d]{24}$/i.test(batchId)) throw new Error('Invalid batch identifier');
  await rm(join(importStorageRoot(), batchId), { force: true, recursive: true });
}
