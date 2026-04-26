import type { TransactionCategoryOption } from '@/types/forms';

export const useTransactionCategories = () => {
  const searchQuery = ref('');
  const isCreating = ref(false);

  const {
    data: categories,
    status,
    refresh,
  } = useFetch<TransactionCategoryOption[]>('/api/transaction-categories', {
    query: computed(() => ({
      q: searchQuery.value || undefined,
    })),
    watch: [searchQuery],
  });

  const isLoading = computed(() => status.value === 'pending');

  async function createCategory(name: string): Promise<TransactionCategoryOption | null> {
    if (!name.trim()) return null;

    isCreating.value = true;
    try {
      const result = await $fetch<TransactionCategoryOption>('/api/transaction-categories', {
        method: 'POST',
        body: { name: name.trim() },
      });
      await refresh();
      return result;
    } catch {
      return null;
    } finally {
      isCreating.value = false;
    }
  }

  function setSearch(query: string) {
    searchQuery.value = query;
  }

  return {
    categories,
    searchQuery,
    isLoading,
    isCreating,
    setSearch,
    createCategory,
    refresh,
  };
};
