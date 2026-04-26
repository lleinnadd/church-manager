import type {
  CongregationType,
  DepartmentScope,
  DepartmentFunctionScope,
  MemberStatus,
  MaritalStatus,
  EventSeriesType,
  TransactionType,
} from '@prisma/client';

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
  scope?: DepartmentFunctionScope | null;
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
  memberNumber?: number;
  name: string;
  congregationId: string;
  status: MemberStatus;
  clerkUserId?: string | null;
  photoUrl?: string | null;
  photoBlobPath?: string | null;
  departments?: MemberDepartmentInput[];
  dateOfBirth?: string | null;
  ssn?: string | null;
  nationalId?: string | null;
  maritalStatus?: MaritalStatus | null;
  addressLinePrimary?: string | null;
  district?: string | null;
  memberSince?: string | null;
  motherName?: string | null;
  fatherName?: string | null;
  naturality?: string | null;
  nationality?: string | null;
  convertionDate?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  observations?: string | null;
}

export interface MemberFormPayload {
  name: string;
  congregationId: string;
  status: MemberStatus;
  photoUrl?: string | null;
  photoBlobPath?: string | null;
  departments: {
    departmentId: string;
    scope: DepartmentScope | null;
    functionId: string | null;
    congregationId: string | null;
  }[];
  dateOfBirth?: string | null;
  ssn?: string | null;
  nationalId?: string | null;
  maritalStatus?: MaritalStatus | null;
  addressLinePrimary?: string | null;
  district?: string | null;
  memberSince?: string | null;
  motherName?: string | null;
  fatherName?: string | null;
  naturality?: string | null;
  nationality?: string | null;
  convertionDate?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  observations?: string | null;
}

export interface EventDayScheduleInput {
  date: string;
  startTime: string;
}

export interface EventMonthlyRuleInput {
  weekday: number;
  ordinal: number;
  startTime: string;
}

export interface EventFormPayload {
  title: string;
  description?: string | null;
  congregationId: string;
  departmentId?: string | null;
  eventType: EventSeriesType;
  startsOn: string;
  endsOn?: string | null;
  sameTimeStart?: string | null;
  daySchedules?: EventDayScheduleInput[];
  monthlyRule?: EventMonthlyRuleInput | null;
}

export interface EventFormData extends EventFormPayload {
  id?: string;
}

export interface TransactionFormPayload {
  name: string;
  type: TransactionType;
  amount: number;
  date: string;
  categoryId?: string | null;
  congregationId?: string | null;
  notes?: string | null;
}

export interface TransactionAttachmentData {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl: string;
  blobPath: string;
}

export interface TransactionFormData extends TransactionFormPayload {
  id?: string;
  category?: { id: string; name: string } | null;
  congregation?: { id: string; name: string; type: CongregationType } | null;
  attachments?: TransactionAttachmentData[];
}

export interface TransactionCategoryOption {
  id: string;
  name: string;
}
