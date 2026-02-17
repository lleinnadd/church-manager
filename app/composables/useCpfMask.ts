export function useCpfMask(initialValue = '') {
  function applyMask(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) {
      return digits;
    }
    if (digits.length <= 6) {
      return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    if (digits.length <= 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  const masked = ref(applyMask(initialValue));

  const unmasked = computed(() => masked.value.replace(/\D/g, ''));

  async function onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPos = input.selectionStart ?? 0;
    const prevLength = input.value.length;

    masked.value = applyMask(input.value);

    await nextTick(() => {
      const diff = input.value.length - prevLength;
      const newPos = Math.max(0, cursorPos + diff);
      input.setSelectionRange(newPos, newPos);
    });
  }

  return { masked, unmasked, onInput };
}
