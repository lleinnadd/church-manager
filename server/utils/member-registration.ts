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

export const registrationMemberLinkSchema = registrationLinkSchema.extend({
  congregationId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
});

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

export async function getRegistrationRequest(token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable' });
  }
  const tokenHash = hashRegistrationToken(token);
  let request = await prisma.memberRegistration.findUnique({ where: { tokenHash } });
  // Import previously issued links without changing their URL or deadline.
  if (!request) {
    const member = await prisma.member.findFirst({
      where: { registrationTokenHash: tokenHash },
      select: { ...registrationMemberSelect, congregationId: true, registrationCreatedBy: true },
    });
    if (!member?.registrationExpiresAt || !member.congregationId) {
      throw createError({ statusCode: 404, statusMessage: 'Link unavailable' });
    }
    if (member.registrationUsedAt) {
      throw createError({
        statusCode: 410,
        statusMessage: 'Link already used',
        data: { code: 'LINK_USED' },
      });
    }
    request = await prisma.memberRegistration.upsert({
      where: { tokenHash },
      create: {
        tokenHash,
        expiresAt: member.registrationExpiresAt,
        createdBy: member.registrationCreatedBy ?? 'legacy',
        congregationId: member.congregationId,
        memberId: member.id,
        memberUpdatedAt: member.updatedAt,
        decisions: [],
      },
      update: {},
    });
  }
  if (request.status === 'SUPERSEDED')
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable' });
  if (request.status !== 'OPEN') {
    throw createError({
      statusCode: 410,
      statusMessage: 'Link already used',
      data: { code: 'LINK_USED' },
    });
  }
  if (request.expiresAt <= now) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Link expired',
      data: { code: 'LINK_EXPIRED' },
    });
  }
  return request;
}

export async function getRegistrationMember(token: string, now = new Date()) {
  const request = await getRegistrationRequest(token, now);
  const member = request.memberId
    ? await prisma.member.findUnique({
        where: { id: request.memberId },
        select: registrationMemberSelect,
      })
    : null;
  if (request.memberId && !member) {
    throw createError({ statusCode: 404, statusMessage: 'Link unavailable' });
  }
  const submission = request.submission as Record<string, unknown> | null;
  return {
    ...member,
    ...submission,
    name: member?.clerkUserId ? member.name : (submission?.name ?? member?.name ?? ''),
    clerkUserId: member?.clerkUserId,
    photoUrl: request.photoUrl ?? member?.photoUrl ?? null,
    registrationExpiresAt: request.expiresAt,
    correctionReason: [...request.decisions]
      .reverse()
      .find((entry) => (entry as Record<string, unknown>)?.action === 'RETURN') as
      | Record<string, unknown>
      | undefined,
  };
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
  const request = await getRegistrationRequest(token);
  const member = await getRegistrationMember(token);
  const parsed = registrationSchema.safeParse(rawData);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid personal information',
      data: { code: 'INVALID_FIELDS', fields: parsed.error.flatten().fieldErrors },
    });
  }
  if (member.clerkUserId && parsed.data.name !== member.name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is managed by your account' });
  }
  if (!photo && !member.photoUrl)
    throw createError({ statusCode: 400, statusMessage: 'Photo is required' });
  if (photo) validateMemberPhotoBuffer(photo.data, photo.type);
  const uploaded = photo ? await uploadMemberPhoto(photo.data, photo.type) : null;
  const now = new Date();
  if (request.memberId) {
    const latest = await prisma.member.findUnique({
      where: { id: request.memberId },
      select: { updatedAt: true },
    });
    if (!latest || latest.updatedAt.getTime() !== member.updatedAt?.getTime()) {
      if (uploaded) await safeDeleteBlob(uploaded.photoBlobPath);
      throw createError({
        statusCode: latest ? 409 : 404,
        statusMessage: 'Member changed. Reload and try again.',
      });
    }
  }
  const result = await prisma.memberRegistration.updateMany({
    where: { id: request.id, updatedAt: request.updatedAt, status: 'OPEN', expiresAt: { gt: now } },
    data: {
      submission: parsed.data,
      status: 'PENDING',
      submittedAt: now,
      photoUrl: uploaded?.photoUrl ?? member.photoUrl,
      photoBlobPath:
        uploaded?.photoBlobPath ?? request.photoBlobPath ?? member.photoBlobPath ?? null,
    },
  });
  if (result.count !== 1) {
    if (uploaded) await safeDeleteBlob(uploaded.photoBlobPath);
    await getRegistrationRequest(token);
    throw createError({
      statusCode: 409,
      statusMessage: 'Registration changed. Reload and try again.',
    });
  }
  return { success: true };
}
