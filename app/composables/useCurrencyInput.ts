export const useCurrencyInput = () => {
  function formatBRL(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function formatInputDisplay(value: number): string {
    if (value === 0) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function parseInput(raw: string): number {
    const cleaned = raw.replace(/[^\d,.-]/g, '').replace(',', '.');
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  }

  return {
    formatBRL,
    formatInputDisplay,
    parseInput,
  };
};
