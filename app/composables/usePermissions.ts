import type { UserPermissionsResponse } from '~~/shared/types/rbac';

export function usePermissions() {
  const { data, status, refresh } = useFetch<UserPermissionsResponse>('/api/auth/permissions', {
    key: 'user-permissions',
    lazy: true,
  });

  const isAdmin = computed(() => data.value?.isAdmin ?? false);
  const isGlobal = computed(() => data.value?.isGlobal ?? false);
  const hasAnyPermission = computed(() => data.value?.hasAnyPermission ?? false);
  const allowedCongregationIds = computed(() => data.value?.allowedCongregationIds ?? []);
  const pending = computed(() => status.value === 'pending');

  function can(resource: string, action: string): boolean {
    if (!data.value) return false;
    if (data.value.isAdmin) return true;

    return data.value.permissions.some(
      (p) => p.resource === resource && (p.action === action || p.action === 'MANAGE'),
    );
  }

  function canAny(resource: string, actions: string[]): boolean {
    return actions.some((action) => can(resource, action));
  }

  return {
    permissions: data,
    pending,
    isAdmin,
    isGlobal,
    hasAnyPermission,
    allowedCongregationIds,
    can,
    canAny,
    refresh,
  };
}
