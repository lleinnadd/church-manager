import type { PermissionAction, PermissionScopeType } from '@prisma/client';

export interface ResolvedPermission {
  resource: string;
  action: PermissionAction;
  scopeType: PermissionScopeType;
}

export interface UserPermissionContext {
  memberId: string;
  clerkUserId: string;
  congregationId: string | null;
  isAdmin: boolean;
  isGlobal: boolean;
  hasAnyPermission: boolean;
  allowedCongregationIds: string[];
  permissions: ResolvedPermission[];
}

export interface UserPermissionsResponse {
  memberId: string;
  congregationId: string | null;
  isAdmin: boolean;
  isGlobal: boolean;
  hasAnyPermission: boolean;
  allowedCongregationIds: string[];
  permissions: {
    resource: string;
    action: string;
    scopeType: string;
  }[];
}
