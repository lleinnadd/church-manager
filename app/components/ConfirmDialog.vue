<script setup lang="ts">
defineProps<{
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

function handleOpenChange(value: boolean) {
  if (!value) emit('cancel');
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
        <AlertDialogCancel :disabled="loading" @click="emit('cancel')">
          {{ cancelLabel ?? 'Cancel' }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="
            variant === 'destructive'
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : ''
          "
          :disabled="loading"
          @click="emit('confirm')"
        >
          {{ loading ? 'Loading...' : (confirmLabel ?? 'Confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
