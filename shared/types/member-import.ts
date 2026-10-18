import type { ImportDraft, ImportExtraction, ImportField } from '../validation/member-import';

export interface ImportCandidate {
  id: string;
  name: string;
  memberNumber: number;
  updatedAt: string;
  clerkUserId: string | null;
  values: Partial<Record<ImportField, string>>;
  reason: 'name' | 'cpf' | 'manual';
  supported: boolean;
  contradiction: boolean;
}
export interface ImportItemView {
  id: string;
  fileName: string;
  status: string;
  revision: number;
  errorCode: string | null;
  extraction: ImportExtraction | null;
  draft: ImportDraft | null;
  savedMemberId: string | null;
  result: string | null;
  candidates: ImportCandidate[];
  blocked: boolean;
  sourceUrl: string;
}
export interface ImportBatchView {
  id: string;
  createdAt: string;
  congregationId: string;
  items: ImportItemView[];
}
