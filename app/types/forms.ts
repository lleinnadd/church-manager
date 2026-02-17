import type { CongregationType, DepartmentScope, MemberStatus } from '@prisma/client';

export interface CongregationFormPayload {
  name: string;
  type: CongregationType;
  since: string;
  zipCode: string;
  addressLinePrimary: string;
  addressLineSecondary: string;
  district: string;
  city: string;
  state: string;
}

export interface CongregationFormData {
  id?: string;
  name: string;
  type: CongregationType;
  since: string | null;
  zipCode: string | null;
  addressLinePrimary: string | null;
  addressLineSecondary: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
}

export interface DepartmentFunctionInput {
  id?: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface DepartmentLocalNameInput {
  id?: string;
  congregationId: string;
  name: string;
}

export interface DepartmentFormPayload {
  name: string;
  description: string;
  hasScopeDivision: boolean;
  functions: DepartmentFunctionInput[];
  localNames: DepartmentLocalNameInput[];
}

export interface DepartmentFormData {
  id?: string;
  name: string;
  description?: string | null;
  hasScopeDivision?: boolean;
  functions?: DepartmentFunctionInput[];
  localNames?: (DepartmentLocalNameInput & {
    congregation?: { id: string; name: string } | null;
  })[];
}

export interface MemberDepartmentInput {
  departmentId: string;
  scope: DepartmentScope | null;
  functionId?: string | null;
  function?: { id: string; name: string; departmentId: string } | null;
  congregationId?: string | null;
}

export interface MemberFormData {
  name: string;
  congregationId: string;
  status: MemberStatus;
  clerkUserId?: string | null;
  departments?: MemberDepartmentInput[];
}

export interface MemberFormPayload {
  name: string;
  congregationId: string;
  status: MemberStatus;
  departments: {
    departmentId: string;
    scope: DepartmentScope | null;
    functionId: string | null;
    congregationId: string | null;
  }[];
}
