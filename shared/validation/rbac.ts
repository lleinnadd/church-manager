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

// Resources that appear in the RBAC profile editor UI. `stats` (dashboard) and
// `rbac` (profile management) are identity-driven — dashboard visibility is
// scoped by `isAdmin`, and RBAC management is admin-only — so they should not
// be assignable as per-profile permissions.
export const EDITABLE_RBAC_RESOURCES = RBAC_RESOURCES.filter(
  (r) => r !== 'stats' && r !== 'rbac',
) as readonly Exclude<(typeof RBAC_RESOURCES)[number], 'stats' | 'rbac'>[];

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

type RbacResource = (typeof RBAC_RESOURCES)[number];
type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const RESOURCE_ACTIONS: Record<RbacResource, readonly PermissionAction[]> = {
  members: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'MANAGE'],
  congregations: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE'],
  departments: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE'],
  events: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'MANAGE'],
  treasury: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'MANAGE'],
  'treasury-config': ['READ', 'UPDATE', 'MANAGE'],
  stats: ['READ'],
  rbac: ['MANAGE'],
} as const;

export const rbacPermissionSchema = z
  .object({
    resource: z.enum(RBAC_RESOURCES),
    action: z.enum(PERMISSION_ACTIONS),
    scopeType: z.enum(PERMISSION_SCOPE_TYPES).default('ALL'),
  })
  .refine(({ resource, action }) => RESOURCE_ACTIONS[resource].includes(action), {
    message: 'Action is not allowed for this resource',
    path: ['action'],
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
