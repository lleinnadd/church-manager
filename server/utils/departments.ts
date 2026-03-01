import { DepartmentFunctionScope } from '@prisma/client';

export interface DepartmentLocalNamePayload {
  congregationId: string;
  name: string;
}

export interface DepartmentFunctionPayload {
  id?: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  scope?: DepartmentFunctionScope | null;
}

export interface NormalizedDepartmentFunction {
  id?: string;
  name: string;
  description: string | null;
  scope: DepartmentFunctionScope | null;
  sortOrder: number;
}

export function normalizeDepartmentLocalNames(
  localNames: DepartmentLocalNamePayload[],
): DepartmentLocalNamePayload[] {
  const normalized = localNames
    .filter((entry) => entry.congregationId && entry.name.trim())
    .map((entry) => ({
      congregationId: entry.congregationId,
      name: entry.name.trim(),
    }));

  const localNamesByCongregation = new Map<string, string>();
  normalized.forEach((entry) => {
    localNamesByCongregation.set(entry.congregationId, entry.name);
  });

  return Array.from(localNamesByCongregation, ([congregationId, name]) => ({
    congregationId,
    name,
  }));
}

export function normalizeDepartmentFunctions(
  functions: DepartmentFunctionPayload[],
  hasScopeDivision: boolean,
): NormalizedDepartmentFunction[] {
  return functions
    .filter((entry) => entry.name.trim())
    .map((entry, index) => ({
      id: entry.id,
      name: entry.name.trim(),
      description: entry.description?.trim() || null,
      scope: hasScopeDivision ? (entry.scope ?? DepartmentFunctionScope.BOTH) : null,
      sortOrder: Number.isFinite(entry.sortOrder) ? Number(entry.sortOrder) : index,
    }));
}
