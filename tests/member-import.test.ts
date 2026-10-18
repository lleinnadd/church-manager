import { describe, expect, it } from 'vitest';
import { PermissionAction, PermissionScopeType } from '@prisma/client';
import {
  importDraftSchema,
  normalizeExtraction,
  normalizeMemberName,
  type ImportDraft,
  type ImportExtraction,
} from '../shared/validation/member-import';
import { importChanges, initialImportDraft } from '../server/utils/member-import';
import { assertImportContext, canImportCongregation } from '../server/utils/member-import-access';
import { detectImportImage } from '../server/utils/member-import-files';
import { extractionConfig } from '../server/utils/member-import-extraction';
import type { UserPermissionContext } from '../shared/types/rbac';

const congregationId = '507f1f77bcf86cd799439011';
const extraction: ImportExtraction = {
  raw: {},
  values: {},
  warnings: {},
  model: 'test',
  durationMs: 1,
};
const draft = (values: ImportDraft['values']): ImportDraft => ({
  ...initialImportDraft(extraction, congregationId),
  values,
  target: 'new',
  approved: true,
});

describe('handwritten form normalization', () => {
  it('normalizes names without changing the saved spelling', () => {
    expect(normalizeMemberName('  TEST  José Silva ')).toBe('test jose silva');
    expect(normalizeExtraction({ name: 'José Silva' }).values.name).toBe('José Silva');
  });
  it('pads shorter numeric RG and requires confirmation', () => {
    const result = normalizeExtraction({ nationalId: '3.123.456' });
    expect(result.values.nationalId).toBe('003123456');
    expect(result.warnings.nationalId).toBe('PADDED_RG');
    expect(normalizeExtraction({ nationalId: '123X456' }).warnings.nationalId).toBe('INVALID_RG');
  });
  it('does not invent a century or roll invalid dates forward', () => {
    const result = normalizeExtraction({
      dateOfBirth: '14/04/11',
      baptismDate: '27/09/26',
      memberSince: '31/02/2026',
    });
    expect(result.values.dateOfBirth).toBe('14/04/11');
    expect(result.warnings.dateOfBirth).toBe('AMBIGUOUS_YEAR');
    expect(result.warnings.baptismDate).toBe('AMBIGUOUS_YEAR');
    expect(result.warnings.memberSince).toBe('INVALID_DATE');
  });
  it('handles printed area codes, blank lines, status and Portuguese marital status', () => {
    expect(
      normalizeExtraction({
        phonePrimary: '(84)',
        phoneSecondary: '(84) 99999-1234',
        convertionDate: '—',
        maritalStatus: 'Casada',
        status: 'Congregando',
      }).values,
    ).toEqual({ phoneSecondary: '84999991234', maritalStatus: 'MARRIED', status: 'ACTIVE' });
  });
  it('keeps baptism separate from conversion and flags nationality and inconsistent birthday month', () => {
    const result = normalizeExtraction({
      baptismDate: '27/09/2026',
      dateOfBirth: '05/02/1971',
      birthdayMonth: 'Março',
      nationality: 'Natalense',
    });
    expect(result.values.baptismDate).toBe('2026-09-27');
    expect(result.values.convertionDate).toBeUndefined();
    expect(result.warnings.nationality).toBe('REVIEW_VALUE');
    expect(result.warnings.dateOfBirth).toBe('BIRTHDAY_MISMATCH');
  });
});

describe('reviewed member changes', () => {
  it('fills gaps and preserves populated and blank form fields', () => {
    const review = draft({
      phonePrimary: '84999991234',
      motherName: 'Test Parent',
      observations: '',
    });
    expect(
      importChanges(review, extraction, {
        motherName: 'Test Parent',
        observations: 'Existing notes',
      }),
    ).toEqual({ phonePrimary: '84999991234' });
  });
  it('requires an explicit choice for conflicting values', () => {
    const review = draft({ district: 'New district' });
    expect(() => importChanges(review, extraction, { district: 'Existing district' })).toThrow();
    review.decisions.district = 'keep';
    expect(importChanges(review, extraction, { district: 'Existing district' })).toEqual({});
    review.decisions.district = 'use';
    expect(importChanges(review, extraction, { district: 'Existing district' })).toEqual({
      district: 'New district',
    });
  });
  it('requires confirmation of a padded RG, allows omission and validates corrected fields', () => {
    const flagged = { ...extraction, ...normalizeExtraction({ nationalId: '1234567' }) };
    const review = draft(flagged.values);
    expect(() => importChanges(review, flagged, {})).toThrow();
    review.confirmedWarnings = ['nationalId'];
    expect(importChanges(review, flagged, {})).toEqual({ nationalId: '001234567' });
    review.values.nationalId = '12';
    expect(() => importChanges(review, flagged, {})).toThrow();
    review.decisions.nationalId = 'omit';
    expect(importChanges(review, flagged, {})).toEqual({});
  });
  it('preserves account-managed names and normalized equivalent values', () => {
    expect(
      importChanges(
        draft({ name: 'New Name', ssn: '52998224725' }),
        extraction,
        { name: 'Account Name', ssn: '529.982.247-25' },
        true,
      ),
    ).toEqual({});
  });
  it('creates incomplete records with name and congregation, and defaults status', () => {
    expect(importChanges(draft({ name: 'Test Person', congregationId }), extraction, null)).toEqual(
      { name: 'Test Person', congregationId, status: 'ACTIVE' },
    );
    expect(() => importChanges(draft({ name: 'Test Person' }), extraction, null)).toThrow();
  });
  it('rejects protected fields in the draft', () => {
    expect(
      importDraftSchema.safeParse({ ...draft({ name: 'Test' }), values: { isAdmin: true } })
        .success,
    ).toBe(false);
    expect(
      importDraftSchema.safeParse({ ...draft({ name: 'Test' }), clerkUserId: 'tampered' }).success,
    ).toBe(false);
  });
});

describe('local import access and upload', () => {
  const ctx: UserPermissionContext = {
    memberId: 'test',
    clerkUserId: 'test',
    congregationId,
    isAdmin: false,
    isGlobal: true,
    hasAnyPermission: true,
    allowedCongregationIds: [congregationId],
    permissions: [
      { resource: 'members', action: PermissionAction.READ, scopeType: PermissionScopeType.ALL },
      {
        resource: 'members',
        action: PermissionAction.CREATE,
        scopeType: PermissionScopeType.OWN_CONGREGATION,
      },
      {
        resource: 'members',
        action: PermissionAction.UPDATE,
        scopeType: PermissionScopeType.OWN_CONGREGATION,
      },
    ],
  };
  it('enforces scopes per action even when read permission is global', () => {
    expect(canImportCongregation(ctx, congregationId)).toBe(true);
    expect(canImportCongregation(ctx, '507f1f77bcf86cd799439012')).toBe(false);
    expect(() =>
      assertImportContext({ ...ctx, permissions: ctx.permissions.slice(0, 1) }),
    ).toThrow();
  });
  it('detects file contents instead of trusting filenames or declared MIME types', () => {
    expect(detectImportImage(Buffer.from([255, 216, 255, 1])).type).toBe('image/jpeg');
    expect(() => detectImportImage(Buffer.from('<svg>not a form</svg>'))).toThrow();
    expect(() => detectImportImage(Buffer.alloc(16 * 1024 * 1024))).toThrow();
  });
  it('rejects remote model endpoints and redirects at configuration time', () => {
    const before = process.env.MEMBER_IMPORT_OLLAMA_URL;
    process.env.MEMBER_IMPORT_OLLAMA_URL = 'https://example.com';
    try {
      expect(() => extractionConfig()).toThrow('LOCAL_ENDPOINT_REQUIRED');
    } finally {
      if (before === undefined) delete process.env.MEMBER_IMPORT_OLLAMA_URL;
      else process.env.MEMBER_IMPORT_OLLAMA_URL = before;
    }
  });
});
