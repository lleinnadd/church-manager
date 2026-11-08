<script setup lang="ts">
import { toast } from 'vue-sonner';

const props = defineProps<{ memberId?: string; currentCongregationId?: string | null }>();
const { t, locale } = useI18n();
const open = ref(false);
const congregationId = ref('');
const { data: congregations } = useFetch<{ id: string; name: string }[]>('/api/congregations', {
  immediate: !props.memberId || !props.currentCongregationId,
});
const loading = ref(false);
const expiration = ref('');
const defaultExpiration = ref('');
const generated = ref<{ url: string; expiresAt: string } | null>(null);

function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function openDialog() {
  expiration.value = localDateTime(new Date(Date.now() + 48 * 3600000));
  defaultExpiration.value = expiration.value;
  generated.value = null;
  open.value = true;
}

async function generate() {
  const date = new Date(expiration.value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    toast.error(t('registration.expirationInvalid'));
    return;
  }
  loading.value = true;
  try {
    const result = await $fetch<{ path: string; expiresAt: string }>(
      props.memberId
        ? `/api/members/${props.memberId}/registration-link`
        : '/api/member-registrations',
      {
        method: 'POST',
        body: {
          ...(expiration.value === defaultExpiration.value
            ? {}
            : { expiresAt: date.toISOString() }),
          ...(!props.memberId || !props.currentCongregationId
            ? { congregationId: congregationId.value }
            : {}),
        },
      },
    );
    generated.value = {
      url: new URL(result.path, window.location.origin).href,
      expiresAt: result.expiresAt,
    };
  } catch {
    toast.error(t('registration.generateError'));
  } finally {
    loading.value = false;
  }
}

async function copyLink() {
  if (!generated.value) return;
  try {
    await navigator.clipboard.writeText(generated.value.url);
    toast.success(t('registration.copied'));
  } catch {
    toast.error(t('registration.copyError'));
  }
}
</script>

<template>
  <Button variant="outline" @click="openDialog">{{ $t('registration.generateLink') }}</Button>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ $t('registration.generateLink') }}</DialogTitle>
        <DialogDescription>{{ $t('registration.linkDescription') }}</DialogDescription>
      </DialogHeader>
      <form v-if="!generated" class="space-y-4" @submit.prevent="generate">
        <div v-if="!memberId || !currentCongregationId" class="space-y-2">
          <Label for="registration-congregation">{{ $t('form.member.congregation') }}</Label>
          <select
            id="registration-congregation"
            v-model="congregationId"
            required
            :disabled="loading"
            class="w-full rounded-md border bg-background p-2"
          >
            <option disabled value="">{{ $t('registration.chooseCongregation') }}</option>
            <option v-for="item in congregations" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </div>
        <div class="space-y-2">
          <Label for="registration-expiration">{{ $t('registration.expiration') }}</Label>
          <Input
            id="registration-expiration"
            v-model="expiration"
            type="datetime-local"
            required
            :disabled="loading"
          />
          <p class="text-sm text-muted-foreground">{{ $t('registration.expirationHint') }}</p>
        </div>
        <Button type="submit" :disabled="loading">
          {{ loading ? $t('common.loading') : $t('registration.generateLink') }}
        </Button>
      </form>
      <div v-else class="space-y-4">
        <div class="space-y-2">
          <Label for="registration-url">{{ $t('registration.link') }}</Label>
          <Input id="registration-url" :model-value="generated.url" readonly />
        </div>
        <p class="text-sm text-muted-foreground">
          {{
            $t('registration.expiresAt', {
              date: new Date(generated.expiresAt).toLocaleString(locale),
            })
          }}
        </p>
        <Button @click="copyLink">{{ $t('registration.copy') }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
