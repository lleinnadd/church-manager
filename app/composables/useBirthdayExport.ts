export function useBirthdayExport() {
  const { locale } = useI18n();

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const selectedYear = ref(now.getFullYear());
  const selectedMonths = ref<string[]>([currentYearMonth]);
  const loading = ref(false);

  const monthsToExport = computed<string[]>(() => {
    return [...selectedMonths.value].sort();
  });

  function toggleMonth(yearMonth: string) {
    const index = selectedMonths.value.indexOf(yearMonth);
    if (index >= 0) {
      selectedMonths.value.splice(index, 1);
    } else {
      selectedMonths.value.push(yearMonth);
    }
  }

  function selectAllMonths() {
    selectedMonths.value = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return `${selectedYear.value}-${m}`;
    });
  }

  function clearSelectedMonths() {
    selectedMonths.value = [];
  }

  async function exportBirthdays() {
    const months = monthsToExport.value;
    if (!months.length) return;

    loading.value = true;

    try {
      const query = new URLSearchParams({
        months: months.join(','),
        locale: locale.value,
      });

      const response = await $fetch<Blob>(`/api/members/birthdays/export?${query.toString()}`, {
        responseType: 'blob',
      });

      const fileName =
        months.length === 1
          ? `aniversariantes-${months[0]}.pdf`
          : `aniversariantes-${months[0]}-a-${months[months.length - 1]}.pdf`;

      const url = URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    const resetNow = new Date();
    const resetYearMonth = `${resetNow.getFullYear()}-${String(resetNow.getMonth() + 1).padStart(2, '0')}`;
    selectedYear.value = resetNow.getFullYear();
    selectedMonths.value = [resetYearMonth];
  }

  return {
    selectedYear,
    selectedMonths,
    loading,
    monthsToExport,
    toggleMonth,
    selectAllMonths,
    clearSelectedMonths,
    exportBirthdays,
    reset,
  };
}
