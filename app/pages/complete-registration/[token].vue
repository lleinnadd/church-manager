<script setup lang="ts">
import { MemberStatus } from '@prisma/client';
import { toast } from 'vue-sonner';
import { memberRegistrationFields } from '#shared/validation/member';
import type { MemberFormData, MemberFormPayload } from '@/types/forms';

definePageMeta({ layout: 'public' });

const { t, locale } = useI18n();
const route = useRoute();
const token = route.params.token as string;
const endpoint = `/api/public/member-registration/${encodeURIComponent(token)}`;
const formVersion = ref(0);
const saving = ref(false);
const saved = ref(false);
const terminalState = ref<'used' | 'expired' | 'unavailable' | null>(null);
const conflict = ref(false);
const { data, status, error, refresh } = await useFetch<{
  member: Omit<MemberFormData, 'congregationId' | 'status'>;
  expiresAt: string;
}>(endpoint);

useHead({
  title: () => t('registration.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
});

function linkState(statusCode: number | undefined, code?: string) {
  if (code === 'LINK_USED') return 'used';
  if (code === 'LINK_EXPIRED') return 'expired';
  if (statusCode === 404) return 'unavailable';
  return null;
}

const pageState = computed(
  () => terminalState.value ?? linkState(error.value?.statusCode, error.value?.data?.data?.code),
);
const initialData = computed<MemberFormData | undefined>(() =>
  data.value
    ? { ...data.value.member, congregationId: '', status: MemberStatus.ACTIVE }
    : undefined,
);

async function submit(values: MemberFormPayload, photo?: File) {
  if (saving.value || saved.value) return;
  saving.value = true;
  conflict.value = false;
  try {
    const body = new FormData();
    const personalDetails = Object.fromEntries(
      Object.keys(memberRegistrationFields).map((field) => [
        field,
        values[field as keyof typeof values],
      ]),
    );
    body.append('data', JSON.stringify(personalDetails));
    if (photo) body.append('file', photo);
    await $fetch(endpoint, { method: 'POST', body });
    saved.value = true;
    data.value = undefined;
  } catch (caught) {
    const failure = caught as { statusCode?: number; data?: { data?: { code?: string } } };
    terminalState.value = linkState(failure.statusCode, failure.data?.data?.code);
    conflict.value = failure.statusCode === 409;
    if (!terminalState.value) {
      toast.error(t(conflict.value ? 'registration.conflict' : 'registration.saveError'));
    }
  } finally {
    saving.value = false;
  }
}

async function reload() {
  conflict.value = false;
  await refresh();
  formVersion.value += 1;
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('registration.title') }}</h1>
      <p class="text-sm text-muted-foreground">{{ $t('registration.description') }}</p>
    </div>
    <Card v-if="saved">
      <CardHeader>
        <CardTitle>{{ $t('registration.successTitle') }}</CardTitle>
        <CardDescription>{{ $t('registration.successDescription') }}</CardDescription>
      </CardHeader>
    </Card>
    <Card v-else-if="pageState">
      <CardHeader>
        <CardTitle>{{ $t(`registration.${pageState}Title`) }}</CardTitle>
        <CardDescription>{{ $t(`registration.${pageState}Description`) }}</CardDescription>
      </CardHeader>
    </Card>
    <Skeleton v-else-if="status === 'pending'" class="h-64 w-full rounded-xl" />
    <Card v-else-if="error">
      <CardHeader>
        <CardTitle>{{ $t('common.errorGeneric') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button @click="reload">{{ $t('registration.reload') }}</Button>
      </CardContent>
    </Card>
    <template v-else-if="data && initialData">
      <p class="text-sm text-muted-foreground">
        {{
          $t('registration.expiresAt', { date: new Date(data.expiresAt).toLocaleString(locale) })
        }}
        {{ $t('registration.finalSaveHint') }}
      </p>
      <div v-if="conflict" class="flex flex-wrap items-center gap-3 rounded-lg border p-4">
        <p class="text-sm">{{ $t('registration.conflict') }}</p>
        <Button type="button" variant="outline" @click="reload">{{
          $t('registration.reload')
        }}</Button>
      </div>
      <MemberForm
        :key="formVersion"
        :initial-data="initialData"
        :loading="saving"
        public-mode
        @submit="submit"
      />
    </template>
  </div>
</template>
