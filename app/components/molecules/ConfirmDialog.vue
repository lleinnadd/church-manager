<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: 'destructive' | 'default';
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const isConfirming = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      isConfirming.value = false;
    }
  },
);

function handleOpenChange(value: boolean) {
  if (!value && !isConfirming.value) emit('cancel');
}

function handleConfirm() {
  if (isConfirming.value || props.loading) return;
  isConfirming.value = true;
  emit('confirm');
}

function handleCancel() {
  if (isConfirming.value) return;
  emit('cancel');
}
</script>

<template>
  <AlertDialog :open="open" @update:open="handleOpenChange">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>
          <slot>{{ description }}</slot>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <Button type="button" variant="outline" :disabled="loading" @click="handleCancel">
          {{ cancelLabel ?? $t('common.cancel') }}
        </Button>
        <Button
          type="button"
          :variant="variant === 'destructive' ? 'destructive' : 'default'"
          :disabled="loading"
          @click="handleConfirm"
        >
          {{ loading ? $t('common.loading') : (confirmLabel ?? $t('common.confirm')) }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
