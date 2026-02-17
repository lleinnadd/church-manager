export function useZipCodeMask(initialValue = '') {
  function applyMask(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return digits;
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
