import type { UserPermissionsResponse } from '~~/shared/types/rbac';

export function usePermissions() {
  const data = useState<UserPermissionsResponse | null>('user-permissions', () => null);
  // Call synchronously so the Nuxt request context (cookies for SSR) is captured.
  const request = useRequestFetch();

  async function fetchPermissions() {
    try {
      data.value = await request<UserPermissionsResponse>('/api/auth/permissions');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[usePermissions] fetch failed:', err);
      data.value = null;
    }
  }

  const isAdmin = computed(() => data.value?.isAdmin ?? false);
  const isGlobal = computed(() => data.value?.isGlobal ?? false);
  const hasAnyPermission = computed(() => data.value?.hasAnyPermission ?? false);
  const allowedCongregationIds = computed(() => data.value?.allowedCongregationIds ?? []);

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
    isAdmin,
    isGlobal,
    hasAnyPermission,
    allowedCongregationIds,
    can,
    canAny,
    refresh: fetchPermissions,
  };
}
