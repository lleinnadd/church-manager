import { createHash, randomBytes } from 'node:crypto';
import { createError } from 'h3';
import { z } from 'zod';
import { createMemberRegistrationSchema } from '../../shared/validation/member';
import prisma from './prisma';
import { uploadMemberPhoto, safeDeleteBlob, validateMemberPhotoBuffer } from './member-photo';

const registrationSchema = createMemberRegistrationSchema();

export const registrationLinkSchema = z
  .object({ expiresAt: z.string().datetime({ offset: true }).optional() })
  .strict();

export const registrationMemberSelect = {
  id: true,
  updatedAt: true,
  clerkUserId: true,
  name: true,
  dateOfBirth: true,
  memberSince: true,
  convertionDate: true,
  ssn: true,
  nationalId: true,
  maritalStatus: true,
  addressLinePrimary: true,
  district: true,
  motherName: true,
  fatherName: true,
  naturality: true,
  nationality: true,
  phonePrimary: true,
  phoneSecondary: true,
  photoUrl: true,
  photoBlobPath: true,
  registrationExpiresAt: true,
  registrationUsedAt: true,
} as const;

export function hashRegistrationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createRegistrationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashRegistrationToken(token) };
}

export function registrationExpiration(expiresAt?: string, now = new Date()) {
  const expiration = expiresAt ? new Date(expiresAt) : new Date(now.getTime() + 48 * 3600000);
  if (Number.isNaN(expiration.getTime()) || expiration <= now) {
    throw createError({ statusCode: 400, statusMessage: 'Expiration must be in the future' });
  }
  return expiration;
}

export async function getRegistrationMember(token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable' });
  }
  const member = await prisma.member.findFirst({
    where: { registrationTokenHash: hashRegistrationToken(token) },
    select: registrationMemberSelect,
  });
  if (!member || !member.registrationExpiresAt) {
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable' });
  }
  if (member.registrationUsedAt) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Link already used',
      data: { code: 'LINK_USED' },
    });
  }
  if (member.registrationExpiresAt <= now) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Link expired',
      data: { code: 'LINK_EXPIRED' },
    });
  }
  return member;
}

export interface RegistrationPhoto {
  data: Buffer;
  type: string;
}

export async function saveMemberRegistration(
  token: string,
  rawData: unknown,
  photo?: RegistrationPhoto,
) {
  const member = await getRegistrationMember(token);
  const parsed = registrationSchema.safeParse(rawData);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid personal information',
      data: { code: 'INVALID_FIELDS', fields: parsed.error.flatten().fieldErrors },
    });
  }
  const body = parsed.data;
  if (member.clerkUserId && body.name !== member.name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is managed by your account' });
  }
  if (!photo && !member.photoUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Photo is required' });
  }
  if (photo) validateMemberPhotoBuffer(photo.data, photo.type);
  const uploaded = photo ? await uploadMemberPhoto(photo.data, photo.type) : null;
  const now = new Date();
  // A single MongoDB document update saves the data and consumes the link together.
  // updatedAt also protects against concurrent staff edits and photo replacements.
  const result = await prisma.member.updateMany({
    where: {
      id: member.id,
      updatedAt: member.updatedAt,
      registrationTokenHash: hashRegistrationToken(token),
      registrationUsedAt: null,
      registrationExpiresAt: { gt: now },
    },
    data: {
      ...body,
      name: member.clerkUserId ? member.name : body.name,
      dateOfBirth: new Date(body.dateOfBirth),
      memberSince: body.memberSince ? new Date(body.memberSince) : null,
      convertionDate: body.convertionDate ? new Date(body.convertionDate) : null,
      nationalId: body.nationalId || null,
      fatherName: body.fatherName || null,
      ...(uploaded ?? {}),
      registrationUsedAt: now,
    },
  });
  // On an ambiguous database error we retain the upload: the write may have committed.
  if (result.count !== 1) {
    if (uploaded) await safeDeleteBlob(uploaded.photoBlobPath);
    await getRegistrationMember(token);
    throw createError({
      statusCode: 409,
      statusMessage: 'Member changed during save. Reload and try again.',
      data: { code: 'MEMBER_CHANGED' },
    });
  }
  if (uploaded && member.photoBlobPath) await safeDeleteBlob(member.photoBlobPath);
  return { success: true };
}
