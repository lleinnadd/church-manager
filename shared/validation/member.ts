import { DepartmentScope, MemberStatus, MaritalStatus } from '@prisma/client';
import { z } from 'zod';

interface MemberValidationMessages {
  required: string;
  cpfInvalid: string;
  rgInvalid: string;
  phoneInvalid: string;
  dateInvalid: string;
}

type MemberValidationMessageOverrides = Partial<MemberValidationMessages>;

const defaultMessages: MemberValidationMessages = {
  required: 'Required field',
  cpfInvalid: 'Invalid CPF',
  rgInvalid: 'Invalid RG',
  phoneInvalid: 'Invalid phone number',
  dateInvalid: 'Invalid date',
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

export const isValidMemberDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const departmentSchema = z.object({
  departmentId: z.string().min(1),
  scope: z.nativeEnum(DepartmentScope).optional().nullable(),
  functionId: z.string().optional().nullable(),
  congregationId: z.string().optional().nullable(),
});

export type MemberDepartmentOutput = z.output<typeof departmentSchema>;

const createRequiredMemberSchema = (messages?: MemberValidationMessageOverrides) => {
  const resolved = resolveMessages(messages);
  const requiredDate = z
    .string()
    .min(1, { message: resolved.required })
    .refine(isValidMemberDate, { message: resolved.dateInvalid });
  const optionalDate = z
    .string()
    .refine((value) => value === '' || isValidMemberDate(value), {
      message: resolved.dateInvalid,
    })
    .optional()
    .nullable();

  return z.object({
    name: z.string().trim().min(1, { message: resolved.required }),
    congregationId: z.string().trim().min(1, { message: resolved.required }),
    status: z.nativeEnum(MemberStatus, { required_error: resolved.required }),
    dateOfBirth: requiredDate,
    memberSince: optionalDate,
    convertionDate: optionalDate,
    ssn: z
      .string()
      .min(1, { message: resolved.required })
      .refine((value) => isValidCpf(value), {
        message: resolved.cpfInvalid,
      }),
    nationalId: z
      .string()
      .refine((value) => value === '' || isValidRg(value), {
        message: resolved.rgInvalid,
      })
      .optional()
      .nullable(),
    maritalStatus: z.nativeEnum(MaritalStatus, { required_error: resolved.required }),
    addressLinePrimary: z.string().trim().min(1, { message: resolved.required }),
    district: z.string().trim().min(1, { message: resolved.required }),
    motherName: z.string().trim().min(1, { message: resolved.required }),
    fatherName: z.string().trim().optional().nullable(),
    naturality: z.string().trim().min(1, { message: resolved.required }),
    nationality: z.string().trim().min(1, { message: resolved.required }),
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
    observations: z.string().trim().min(1, { message: resolved.required }),
    departments: z.array(departmentSchema).optional().default([]),
  });
};

export const createMemberSchema = (messages?: MemberValidationMessageOverrides) => {
  const resolved = resolveMessages(messages);
  const optionalString = z
    .string()
    .nullish()
    .transform((value) => (value === '' ? null : value));

  return z.object({
    name: z.string({ required_error: resolved.required }).min(1, { message: resolved.required }),
    congregationId: z
      .string({ required_error: resolved.required })
      .min(1, { message: resolved.required }),
    status: z.nativeEnum(MemberStatus).nullish(),
    dateOfBirth: optionalString,
    memberSince: optionalString,
    convertionDate: optionalString,
    ssn: optionalString.refine((value) => !value || isValidCpf(value), {
      message: resolved.cpfInvalid,
    }),
    nationalId: optionalString.refine((value) => !value || isValidRg(value), {
      message: resolved.rgInvalid,
    }),
    maritalStatus: z.nativeEnum(MaritalStatus).nullish(),
    addressLinePrimary: optionalString,
    district: optionalString,
    motherName: optionalString,
    fatherName: optionalString,
    naturality: optionalString,
    nationality: optionalString,
    phonePrimary: optionalString.refine((value) => !value || isValidPhoneNumber(value), {
      message: resolved.phoneInvalid,
    }),
    phoneSecondary: optionalString.refine((value) => !value || isValidPhoneNumber(value), {
      message: resolved.phoneInvalid,
    }),
    photoUrl: z.string().url().optional().nullable(),
    photoBlobPath: z.string().min(1).optional().nullable(),
    observations: optionalString,
    departments: z.array(departmentSchema).optional().default([]),
  });
};

export type MemberSchemaInput = z.input<ReturnType<typeof createMemberSchema>>;
export type MemberSchemaOutput = z.output<ReturnType<typeof createMemberSchema>>;

export const memberRegistrationFields = {
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
} as const;

export const createMemberRegistrationSchema = (messages?: MemberValidationMessageOverrides) =>
  createRequiredMemberSchema(messages).pick(memberRegistrationFields).strict();

export type MemberRegistrationInput = z.input<ReturnType<typeof createMemberRegistrationSchema>>;
