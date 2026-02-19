<script setup lang="ts">
import { cn } from '~/lib/utils';

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
          {{ cancelLabel ?? $t('common.cancel') }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="
            cn(
              variant === 'destructive' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )
          "
          :disabled="loading"
          @click="emit('confirm')"
        >
          {{ loading ? $t('common.loading') : (confirmLabel ?? $t('common.confirm')) }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
