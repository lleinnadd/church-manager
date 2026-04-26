type ExportMode = 'current' | 'year' | 'custom';

export function useCalendarExport() {
  const { locale } = useI18n();

  const exportMode = ref<ExportMode>('current');
  const selectedYear = ref(new Date().getFullYear());
  const selectedMonths = ref<string[]>([]);
  const currentMonth = ref('');
  const loading = ref(false);
  const includeMiniCalendars = ref(true);

  function setCurrentMonth(yearMonth: string) {
    currentMonth.value = yearMonth;
  }

  const monthsToExport = computed<string[]>(() => {
    if (exportMode.value === 'current') {
      return currentMonth.value ? [currentMonth.value] : [];
    }

    if (exportMode.value === 'year') {
      return Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        return `${selectedYear.value}-${m}`;
      });
    }

    return [...selectedMonths.value].sort();
  });

  const monthsAreSequential = computed<boolean>(() => {
    const months = monthsToExport.value;
    if (months.length <= 1) return true;

    const indices = months.map((m) => {
      const [y, mm] = m.split('-').map(Number);
      return y! * 12 + (mm! - 1);
    });

    for (let i = 1; i < indices.length; i += 1) {
      if (indices[i]! - indices[i - 1]! !== 1) return false;
    }
    return true;
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

  async function exportCalendar(congregationId?: string) {
    const months = monthsToExport.value;
    if (!months.length) return;

    loading.value = true;

    try {
      const query = new URLSearchParams({
        months: months.join(','),
        locale: locale.value,
        miniCalendars: monthsAreSequential.value && includeMiniCalendars.value ? 'true' : 'false',
      });

      if (congregationId) {
        query.set('congregationId', congregationId);
      }

      const response = await $fetch<Blob>(`/api/events/export?${query.toString()}`, {
        responseType: 'blob',
      });

      const fileName =
        months.length === 1
          ? `calendario-${months[0]}.pdf`
          : `calendario-${months[0]}-a-${months[months.length - 1]}.pdf`;

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
    exportMode.value = 'current';
    selectedMonths.value = [];
    includeMiniCalendars.value = true;
  }

  return {
    exportMode,
    selectedYear,
    selectedMonths,
    currentMonth,
    loading,
    includeMiniCalendars,
    monthsToExport,
    monthsAreSequential,
    setCurrentMonth,
    toggleMonth,
    selectAllMonths,
    clearSelectedMonths,
    exportCalendar,
    reset,
  };
}
