import { describe, expect, it } from 'vitest';
import { MemberStatus } from '@prisma/client';
import { createMemberRegistrationSchema, createMemberSchema } from '../shared/validation/member';
import {
  isPublicMemberRegistrationApi,
  isPublicMemberRegistrationPage,
} from '../shared/utils/member-registration';
import {
  createRegistrationToken,
  registrationExpiration,
  registrationLinkSchema,
} from '../server/utils/member-registration';
import { validateMemberPhotoBuffer } from '../server/utils/member-photo';
import { personalDetails, validPhoto } from './fixtures/member-registration';

describe('registration validation', () => {
  const schema = createMemberRegistrationSchema();

  it('allows the four optional fields to be blank, null, or omitted', () => {
    expect(schema.safeParse(personalDetails).success).toBe(true);
    const optional = ['fatherName', 'nationalId', 'memberSince', 'convertionDate'] as const;
    optional.forEach((field) => {
      expect(schema.safeParse({ ...personalDetails, [field]: null }).success).toBe(true);
      const details = { ...personalDetails } as Partial<typeof personalDetails>;
      delete details[field];
      expect(schema.safeParse(details).success).toBe(true);
    });
  });

  it.each(['name', 'dateOfBirth', 'motherName', 'phonePrimary', 'phoneSecondary', 'ssn'])(
    'requires %s',
    (field) => {
      expect(schema.safeParse({ ...personalDetails, [field]: '' }).success).toBe(false);
    },
  );

  it.each([
    ['ssn', '11111111111'],
    ['nationalId', '123'],
    ['phonePrimary', '123'],
    ['phoneSecondary', '123'],
    ['dateOfBirth', '2026-02-30'],
    ['memberSince', '2026-13-01'],
    ['convertionDate', 'not-a-date'],
    ['name', '   '],
  ])('rejects invalid %s', (field, value) => {
    expect(schema.safeParse({ ...personalDetails, [field]: value }).success).toBe(false);
  });

  it.each([
    'departments',
    'isAdmin',
    'clerkUserId',
    'status',
    'congregationId',
    'observations',
    'photoUrl',
    'photoBlobPath',
  ])('rejects protected field %s', (field) => {
    expect(schema.safeParse({ ...personalDetails, [field]: 'tampered' }).success).toBe(false);
  });

  it('allows staff to save the same optional fields blank', () => {
    expect(
      createMemberSchema().safeParse({
        ...personalDetails,
        congregationId: '507f1f77bcf86cd799439011',
        status: MemberStatus.ACTIVE,
        observations: 'Internal observations',
      }).success,
    ).toBe(true);
  });

  it('preserves the active checkout staff form requirements while keeping public registration complete', () => {
    const minimum = { name: 'Staff entry', congregationId: '507f1f77bcf86cd799439011' };
    expect(createMemberSchema().safeParse(minimum).success).toBe(true);
    expect(schema.safeParse({ name: minimum.name }).success).toBe(false);
  });
});

describe('registration links', () => {
  it('defaults to exactly 48 hours and supports a custom expiration', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(registrationExpiration(undefined, now).toISOString()).toBe('2026-10-06T12:00:00.000Z');
    expect(registrationExpiration('2026-10-05T12:00:00Z', now).toISOString()).toBe(
      '2026-10-05T12:00:00.000Z',
    );
    expect(() => registrationExpiration(now.toISOString(), now)).toThrow();
    expect(() => registrationExpiration('invalid', now)).toThrow();
    expect(registrationLinkSchema.safeParse({ expiresAt: 'invalid' }).success).toBe(false);
  });

  it('generates distinct 256-bit tokens and stores only hashes', () => {
    const first = createRegistrationToken();
    const second = createRegistrationToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toContain(first.token);
  });

  it('exempts only the exact public page and GET/POST endpoints', () => {
    expect(isPublicMemberRegistrationPage('/complete-registration/token')).toBe(true);
    expect(isPublicMemberRegistrationPage('/members/id/edit')).toBe(false);
    expect(isPublicMemberRegistrationPage('/complete-registration/token/edit')).toBe(false);
    expect(isPublicMemberRegistrationApi('/api/public/member-registration/token', 'GET')).toBe(
      true,
    );
    expect(isPublicMemberRegistrationApi('/api/public/member-registration/token', 'POST')).toBe(
      true,
    );
    expect(isPublicMemberRegistrationApi('/api/public/member-registration/token', 'PUT')).toBe(
      false,
    );
    expect(isPublicMemberRegistrationApi('/api/members/id/registration-link', 'POST')).toBe(false);
    expect(
      isPublicMemberRegistrationApi('/api/public/member-registration/token/photo', 'POST'),
    ).toBe(false);
  });
});

describe('registration photos', () => {
  it('accepts a 300x400 PNG and rejects invalid content, types, and oversized files', () => {
    expect(() => validateMemberPhotoBuffer(validPhoto, 'image/png')).not.toThrow();
    expect(() => validateMemberPhotoBuffer(validPhoto, 'image/webp')).toThrow();
    expect(() => validateMemberPhotoBuffer(validPhoto, 'image/jpeg')).toThrow();
    expect(() => validateMemberPhotoBuffer(Buffer.from('corrupt'), 'image/png')).toThrow();
    expect(() =>
      validateMemberPhotoBuffer(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png'),
    ).toThrow();
    const small = Buffer.from(validPhoto);
    small.writeUInt32BE(299, 16);
    expect(() => validateMemberPhotoBuffer(small, 'image/png')).toThrow();
  });
});
