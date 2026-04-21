import type { DashboardStatsPayload } from '~~/shared/types/stats';

export function useDashboardStats() {
  const congregationId = ref<string | null>(null);

  const { data, pending, error, refresh } = useFetch<DashboardStatsPayload>('/api/stats', {
    query: computed(() => ({
      congregationId: congregationId.value || undefined,
    })),
    watch: [congregationId],
  });

  return {
    stats: data,
    pending,
    error,
    refresh,
    congregationId,
  };
}
