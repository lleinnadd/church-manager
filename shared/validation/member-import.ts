import { MaritalStatus, MemberStatus } from '@prisma/client';
import { z } from 'zod';
import { digitsOnly, isValidCpf, isValidMemberDate, isValidPhoneNumber, isValidRg } from './member';

export const importFields = [
  'name',
  'dateOfBirth',
  'ssn',
  'nationalId',
  'maritalStatus',
  'addressLinePrimary',
  'district',
  'memberSince',
  'baptismDate',
  'motherName',
  'fatherName',
  'naturality',
  'nationality',
  'convertionDate',
  'phonePrimary',
  'phoneSecondary',
  'observations',
  'status',
  'congregationId',
] as const;
export type ImportField = (typeof importFields)[number];
export type ImportValues = Partial<Record<ImportField, string>>;
export type FieldDecision = 'keep' | 'use' | 'omit';
export interface ImportExtraction {
  raw: Record<string, string | null>;
  values: ImportValues;
  warnings: Partial<Record<ImportField, string>>;
  model: string;
  durationMs: number;
}
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
const valuesSchema = z
  .object(Object.fromEntries(importFields.map((field) => [field, z.string().max(4000).optional()])))
  .strict();
export const importDraftSchema = z
  .object({
    values: valuesSchema,
    target: z.enum(['new', 'existing']).nullable(),
    memberId: objectIdSchema.nullable(),
    memberUpdatedAt: z.string().datetime().nullable(),
    decisions: z.record(z.enum(importFields), z.enum(['keep', 'use', 'omit'])),
    confirmedWarnings: z.array(z.enum(importFields)),
    approved: z.boolean(),
  })
  .strict();
export type ImportDraft = Omit<z.infer<typeof importDraftSchema>, 'values'> & {
  values: ImportValues;
};
export const revisionSchema = z.object({ revision: z.number().int().nonnegative() }).strict();
export const draftRequestSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    draft: importDraftSchema,
  })
  .strict();

export const normalizeMemberName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
export const blankImportValue = (value: unknown) => value == null || String(value).trim() === '';
const dateFields = new Set<ImportField>([
  'dateOfBirth',
  'memberSince',
  'baptismDate',
  'convertionDate',
]);
export function comparableImportValue(field: ImportField, value: unknown): string {
  if (blankImportValue(value)) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (dateFields.has(field)) return String(value).slice(0, 10);
  if (['ssn', 'nationalId', 'phonePrimary', 'phoneSecondary'].includes(field))
    return digitsOnly(String(value));
  return String(value).trim();
}

export function importFieldError(field: ImportField, value: string): string | null {
  if (!value.trim()) return null;
  if (dateFields.has(field) && !isValidMemberDate(value)) return 'INVALID_DATE';
  if (field === 'ssn' && !isValidCpf(value)) return 'INVALID_CPF';
  if (field === 'nationalId' && !isValidRg(value)) return 'INVALID_RG';
  if (['phonePrimary', 'phoneSecondary'].includes(field) && !isValidPhoneNumber(value))
    return 'INVALID_PHONE';
  if (field === 'maritalStatus' && !Object.values(MaritalStatus).includes(value as MaritalStatus))
    return 'INVALID_VALUE';
  if (field === 'status' && !Object.values(MemberStatus).includes(value as MemberStatus))
    return 'INVALID_VALUE';
  if (field === 'congregationId' && !objectIdSchema.safeParse(value).success)
    return 'INVALID_VALUE';
  return null;
}

export function normalizeExtraction(
  raw: Record<string, string | null>,
): Pick<ImportExtraction, 'values' | 'warnings'> {
  const values: ImportValues = {};
  const warnings: ImportExtraction['warnings'] = {};
  importFields.forEach((field) => {
    let value = raw[field]?.trim();
    if (!value || /^[-–—_\s]+$/.test(value) || field === 'congregationId') return;
    if (dateFields.has(field)) {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
      if (match) value = `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
      else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value)) warnings[field] = 'AMBIGUOUS_YEAR';
    }
    if (['ssn', 'nationalId', 'phonePrimary', 'phoneSecondary'].includes(field)) {
      // A printed area code without a handwritten number is not a phone number.
      if (field.startsWith('phone') && digitsOnly(value).length <= 2) return;
      if (field === 'nationalId' && !/^[\d.\s-]+$/.test(value)) warnings[field] = 'INVALID_RG';
      else value = digitsOnly(value);
      if (field === 'nationalId' && /^\d{1,8}$/.test(value)) {
        value = value.padStart(9, '0');
        warnings[field] = 'PADDED_RG';
      }
    }
    if (field === 'maritalStatus') {
      const key = normalizeMemberName(value);
      value =
        (
          {
            solteiro: 'SINGLE',
            solteira: 'SINGLE',
            casado: 'MARRIED',
            casada: 'MARRIED',
            divorciado: 'DIVORCED',
            divorciada: 'DIVORCED',
            viuvo: 'WIDOWED',
            viuva: 'WIDOWED',
            separado: 'SEPARATED',
            separada: 'SEPARATED',
          } as Record<string, string>
        )[key] ?? value;
    }
    if (field === 'status') {
      const key = normalizeMemberName(value);
      value =
        (
          {
            congregando: 'ACTIVE',
            'mudou de congregacao': 'TRANSFERRED',
            'afastou-se': 'WITHDRAWN',
          } as Record<string, string>
        )[key] ?? value;
    }
    values[field] = value;
    const error = importFieldError(field, value);
    if (error && !warnings[field]) warnings[field] = error;
    if (
      field === 'nationality' &&
      !['brasileira', 'brasileiro'].includes(normalizeMemberName(value))
    )
      warnings[field] = 'REVIEW_VALUE';
  });
  if (raw.birthdayMonth && values.dateOfBirth && isValidMemberDate(values.dateOfBirth)) {
    const months = [
      'janeiro',
      'fevereiro',
      'marco',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ];
    if (
      months[Number(values.dateOfBirth.slice(5, 7)) - 1] !== normalizeMemberName(raw.birthdayMonth)
    )
      warnings.dateOfBirth = 'BIRTHDAY_MISMATCH';
  }
  return { values, warnings };
}
