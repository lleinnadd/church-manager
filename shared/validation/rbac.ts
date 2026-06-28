import { z } from 'zod';
import { DepartmentScope, PermissionAction, PermissionScopeType } from '@prisma/client';

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

export const rbacPermissionSchema = z.object({
  resource: z.enum(RBAC_RESOURCES),
  action: z.nativeEnum(PermissionAction),
  scopeType: z.nativeEnum(PermissionScopeType).default(PermissionScopeType.ALL),
});

export const rbacProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(rbacPermissionSchema).min(1),
});

export const rbacBindingSchema = z.object({
  functionId: z.string().min(1),
  scope: z.nativeEnum(DepartmentScope),
});
