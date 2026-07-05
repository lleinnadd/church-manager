import { z } from 'zod';

export const RBAC_RESOURCES = [
  'members',
  'congregations',
  'departments',
  'events',
  'treasury',
  'treasury-config',
  'stats',
  'rbac',
] as const;

// Plain string constants that mirror the Prisma enums. Kept free of any
// `@prisma/client` runtime import so this module is safe to bundle for the
// browser (Prisma's generated client is server-only).
export const PERMISSION_ACTIONS = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'EXPORT',
  'MANAGE',
] as const;

export const PERMISSION_SCOPE_TYPES = ['ALL', 'OWN_CONGREGATION'] as const;

export const DEPARTMENT_SCOPES = ['LOCAL', 'GENERAL'] as const;

export const rbacPermissionSchema = z.object({
  resource: z.enum(RBAC_RESOURCES),
  action: z.enum(PERMISSION_ACTIONS),
  scopeType: z.enum(PERMISSION_SCOPE_TYPES).default('ALL'),
});

export const rbacBindingSchema = z.object({
  functionId: z.string().min(1),
  scope: z.enum(DEPARTMENT_SCOPES),
});

export const rbacProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(rbacPermissionSchema).min(1),
  bindings: z.array(rbacBindingSchema).optional(),
});

export const rbacBindingBatchSchema = z.object({
  bindings: z.array(rbacBindingSchema).min(1),
});
