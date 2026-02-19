import { DepartmentScope, MemberStatus, MaritalStatus } from '@prisma/client';
import { z } from 'zod';
import type { Composer } from 'vue-i18n';

const requiredMessage = (t: Composer['t']) => t('validation.required');

const digitsOnly = (value: string) => value.replace(/\D/g, '');

function isValidCpf(rawValue: string): boolean {
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

export const buildMemberFormSchema = (t: Composer['t']) => {
  const required = requiredMessage(t);

  return z.object({
    name: z.string().min(1, { message: required }),
    congregationId: z.string().min(1, { message: required }),
    status: z.nativeEnum(MemberStatus, { required_error: required }),
    dateOfBirth: z.string().min(1, { message: required }),
    memberSince: z.string().min(1, { message: required }),
    convertionDate: z.string().min(1, { message: required }),
    ssn: z
      .string()
      .min(1, { message: required })
      .refine((value) => isValidCpf(value), {
        message: t('validation.cpfInvalid'),
      }),
    nationalId: z
      .string()
      .min(1, { message: required })
      .refine((value) => digitsOnly(value).length === 9, {
        message: t('validation.rgInvalid'),
      }),
    maritalStatus: z.nativeEnum(MaritalStatus, { required_error: required }),
    addressLinePrimary: z.string().min(1, { message: required }),
    district: z.string().min(1, { message: required }),
    motherName: z.string().min(1, { message: required }),
    fatherName: z.string().min(1, { message: required }),
    naturality: z.string().min(1, { message: required }),
    nationality: z.string().min(1, { message: required }),
    phonePrimary: z
      .string()
      .min(1, { message: required })
      .refine(
        (value) => {
          const { length } = digitsOnly(value);
          return length === 10 || length === 11;
        },
        {
          message: t('validation.phoneInvalid'),
        },
      ),
    phoneSecondary: z
      .string()
      .min(1, { message: required })
      .refine(
        (value) => {
          const { length } = digitsOnly(value);
          return length === 10 || length === 11;
        },
        {
          message: t('validation.phoneInvalid'),
        },
      ),
    observations: z.string().min(1, { message: required }),
    departments: z
      .array(
        z.object({
          departmentId: z.string().min(1, { message: required }),
          scope: z.nativeEnum(DepartmentScope).optional().nullable(),
          functionId: z.string().optional().nullable(),
          congregationId: z.string().optional().nullable(),
        }),
      )
      .optional()
      .default([]),
  });
};
