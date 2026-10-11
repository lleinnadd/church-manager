import { PermissionAction, PermissionScopeType } from '@prisma/client';
import type { ResolvedPermission, UserPermissionContext } from '~~/shared/types/rbac';

const ALL_RESOURCES = [
  'members',
  'congregations',
  'departments',
  'events',
  'treasury',
  'treasury-config',
  'stats',
  'rbac',
] as const;

function buildAdminContext(
  memberId: string,
  clerkUserId: string,
  congregationId: string | null,
): UserPermissionContext {
  const permissions: ResolvedPermission[] = ALL_RESOURCES.map((resource) => ({
    resource,
    action: PermissionAction.MANAGE,
    scopeType: PermissionScopeType.ALL,
  }));

  return {
    memberId,
    clerkUserId,
    congregationId,
    isAdmin: true,
    isGlobal: true,
    hasAnyPermission: true,
    allowedCongregationIds: [],
    permissions,
  };
}

export async function resolveUserPermissions(
  clerkUserId: string,
): Promise<UserPermissionContext | null> {
  const member = await prisma.member.findUnique({
    where: { clerkUserId },
    select: {
      id: true,
      congregationId: true,
      isAdmin: true,
      departments: {
        select: {
          functionId: true,
          scope: true,
          congregationId: true,
        },
      },
    },
  });

  if (!member) return null;

  if (member.isAdmin) {
    return buildAdminContext(member.id, clerkUserId, member.congregationId);
  }

  const bindingLookups = member.departments
    .filter((d) => d.functionId && d.scope)
    .map((d) => ({ functionId: d.functionId!, scope: d.scope! }));

  if (bindingLookups.length === 0) {
    return {
      memberId: member.id,
      clerkUserId,
      congregationId: member.congregationId,
      isAdmin: false,
      isGlobal: false,
      hasAnyPermission: false,
      allowedCongregationIds: [],
      permissions: [],
    };
  }

  const bindings = await prisma.rbacProfileBinding.findMany({
    where: {
      OR: bindingLookups.map((l) => ({
        functionId: l.functionId,
        scope: l.scope,
      })),
    },
    select: { profileId: true },
  });

  const profileIds = [...new Set(bindings.map((b) => b.profileId))];

  if (profileIds.length === 0) {
    return {
      memberId: member.id,
      clerkUserId,
      congregationId: member.congregationId,
      isAdmin: false,
      isGlobal: false,
      hasAnyPermission: false,
      allowedCongregationIds: [],
      permissions: [],
    };
  }

  const rawPermissions = await prisma.rbacPermission.findMany({
    where: { profileId: { in: profileIds } },
    select: { resource: true, action: true, scopeType: true },
  });

  const permMap = new Map<string, ResolvedPermission>();
  for (const perm of rawPermissions) {
    const key = `${perm.resource}:${perm.action}`;
    const existing = permMap.get(key);
    if (!existing || perm.scopeType === PermissionScopeType.ALL) {
      permMap.set(key, {
        resource: perm.resource,
        action: perm.action,
        scopeType:
          existing?.scopeType === PermissionScopeType.ALL
            ? PermissionScopeType.ALL
            : perm.scopeType,
      });
    }
  }

  const permissions = [...permMap.values()];

  const allowedCongregationIds = new Set<string>();
  if (member.congregationId) {
    allowedCongregationIds.add(member.congregationId);
  }
  for (const dept of member.departments) {
    if (dept.congregationId) {
      allowedCongregationIds.add(dept.congregationId);
    }
  }

  const isGlobal = permissions.some((p) => p.scopeType === PermissionScopeType.ALL);

  return {
    memberId: member.id,
    clerkUserId,
    congregationId: member.congregationId,
    isAdmin: false,
    isGlobal,
    hasAnyPermission: permissions.length > 0,
    allowedCongregationIds: [...allowedCongregationIds],
    permissions,
  };
}

export function hasPermission(
  ctx: UserPermissionContext,
  resource: string,
  action: PermissionAction,
): boolean {
  if (ctx.isAdmin) return true;

  return ctx.permissions.some(
    (p) => p.resource === resource && (p.action === action || p.action === PermissionAction.MANAGE),
  );
}

export function assertPermission(
  ctx: UserPermissionContext | null | undefined,
  resource: string,
  action: PermissionAction,
): asserts ctx is UserPermissionContext {
  if (!ctx || !hasPermission(ctx, resource, action)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
}

export function assertAdmin(
  ctx: UserPermissionContext | null | undefined,
): asserts ctx is UserPermissionContext {
  if (!ctx?.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
}

export function getPermissionScopeType(
  ctx: UserPermissionContext,
  resource: string,
): PermissionScopeType {
  if (ctx.isAdmin) return PermissionScopeType.ALL;

  let best: PermissionScopeType = PermissionScopeType.OWN_CONGREGATION;
  for (const p of ctx.permissions) {
    if (p.resource === resource && p.scopeType === PermissionScopeType.ALL) {
      return PermissionScopeType.ALL;
    }
    if (p.resource === resource) {
      best = p.scopeType;
    }
  }
  return best;
}

export function getCongregationFilter(
  ctx: UserPermissionContext,
  resource: string,
  fieldName = 'congregationId',
): Record<string, unknown> {
  const scope = getPermissionScopeType(ctx, resource);
  if (scope === PermissionScopeType.ALL) return {};
  return { [fieldName]: { in: ctx.allowedCongregationIds } };
}

export function assertCongregationAccess(
  ctx: UserPermissionContext,
  resource: string,
  congregationId: string | null | undefined,
): void {
  if (ctx.isAdmin) return;

  const scope = getPermissionScopeType(ctx, resource);
  if (scope === PermissionScopeType.ALL) return;

  if (!congregationId || !ctx.allowedCongregationIds.includes(congregationId)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
}

export function assertGlobalScope(ctx: UserPermissionContext, resource: string): void {
  if (ctx.isAdmin) return;
  if (getPermissionScopeType(ctx, resource) !== PermissionScopeType.ALL) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
}

export function getScopedCongregationId(
  ctx: UserPermissionContext,
  resource: string,
  requested: string | null | undefined,
): string {
  if (requested) {
    assertCongregationAccess(ctx, resource, requested);
    return requested;
  }

  const scope = getPermissionScopeType(ctx, resource);
  if (scope === PermissionScopeType.ALL) {
    throw createError({ statusCode: 400, statusMessage: 'congregationId is required' });
  }

  const primary = ctx.congregationId ?? ctx.allowedCongregationIds[0] ?? null;
  if (!primary) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
  return primary;
}

export function getRbacContext(event: unknown): UserPermissionContext | null {
  return (event as Record<string, Record<string, unknown>>)?.context
    ?.rbac as UserPermissionContext | null;
}

export function dedupeBindings<T extends { functionId: string; scope: string }>(
  bindings: T[],
): T[] {
  const seen = new Set<string>();
  return bindings.filter((b) => {
    const key = `${b.functionId}:${b.scope}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
