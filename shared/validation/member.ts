import { DepartmentScope, MemberStatus, MaritalStatus } from '@prisma/client';
import { z } from 'zod';

interface MemberValidationMessages {
  required: string;
  cpfInvalid: string;
  rgInvalid: string;
  phoneInvalid: string;
}

type MemberValidationMessageOverrides = Partial<MemberValidationMessages>;

const defaultMessages: MemberValidationMessages = {
  required: 'Required field',
  cpfInvalid: 'Invalid CPF',
  rgInvalid: 'Invalid RG',
  phoneInvalid: 'Invalid phone number',
};

const resolveMessages = (
  overrides?: MemberValidationMessageOverrides,
): MemberValidationMessages => ({
  ...defaultMessages,
  ...overrides,
});

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

export function isValidCpf(rawValue: string): boolean {
  const digits = digitsOnly(rawValue);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const numbers = digits.split('').map((value) => Number(value));
  if (numbers.some(Number.isNaN)) return false;

  const calcCheckDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += numbers[i]! * (length + 1 - i);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const firstCheck = calcCheckDigit(9);
  const secondCheck = calcCheckDigit(10);

  return firstCheck === numbers[9] && secondCheck === numbers[10];
}

export const isValidRg = (value: string) => digitsOnly(value).length === 9;

export const isValidPhoneNumber = (value: string) => {
  const { length } = digitsOnly(value);
  return length === 10 || length === 11;
};

export const departmentSchema = z.object({
  departmentId: z.string().min(1),
  scope: z.nativeEnum(DepartmentScope).optional().nullable(),
  functionId: z.string().optional().nullable(),
  congregationId: z.string().optional().nullable(),
});

export type MemberDepartmentOutput = z.output<typeof departmentSchema>;

export const createMemberSchema = (messages?: MemberValidationMessageOverrides) => {
  const resolved = resolveMessages(messages);

  return z.object({
    name: z.string().min(1, { message: resolved.required }),
    congregationId: z.string().min(1, { message: resolved.required }),
    status: z.nativeEnum(MemberStatus, { required_error: resolved.required }),
    dateOfBirth: z.string().min(1, { message: resolved.required }),
    memberSince: z.string().min(1, { message: resolved.required }),
    convertionDate: z.string().min(1, { message: resolved.required }),
    ssn: z
      .string()
      .min(1, { message: resolved.required })
      .refine((value) => isValidCpf(value), {
        message: resolved.cpfInvalid,
      }),
    nationalId: z
      .string()
      .min(1, { message: resolved.required })
      .refine((value) => isValidRg(value), {
        message: resolved.rgInvalid,
      }),
    maritalStatus: z.nativeEnum(MaritalStatus, { required_error: resolved.required }),
    addressLinePrimary: z.string().min(1, { message: resolved.required }),
    district: z.string().min(1, { message: resolved.required }),
    motherName: z.string().min(1, { message: resolved.required }),
    fatherName: z.string().min(1, { message: resolved.required }),
    naturality: z.string().min(1, { message: resolved.required }),
    nationality: z.string().min(1, { message: resolved.required }),
    phonePrimary: z
      .string()
      .min(1, { message: resolved.required })
      .refine((value) => isValidPhoneNumber(value), {
        message: resolved.phoneInvalid,
      }),
    phoneSecondary: z
      .string()
      .min(1, { message: resolved.required })
      .refine((value) => isValidPhoneNumber(value), {
        message: resolved.phoneInvalid,
      }),
    photoUrl: z.string().url().optional().nullable(),
    photoBlobPath: z.string().min(1).optional().nullable(),
    observations: z.string().min(1, { message: resolved.required }),
    departments: z.array(departmentSchema).optional().default([]),
  });
};

export type MemberSchemaInput = z.input<ReturnType<typeof createMemberSchema>>;
export type MemberSchemaOutput = z.output<ReturnType<typeof createMemberSchema>>;
