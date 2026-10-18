<script setup lang="ts">
import { Button } from '@/components/ui/button';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'members', action: 'READ' },
});
const { can } = usePermissions();
const { t } = useI18n();
const { data, refresh } = await useFetch<{
  enabled: boolean;
  batches: {
    id: string;
    createdAt: string;
    congregationId: string;
    items: { status: string; result: string | null }[];
  }[];
  congregations: { id: string; name: string }[];
}>('/api/member-imports');
const congregationId = ref('');
const files = ref<File[]>([]);
const busy = ref(false);
const progress = ref('');
const error = ref('');

function pickFiles(event: Event) {
  files.value = Array.from((event.target as HTMLInputElement).files || []);
  error.value = '';
}
async function upload() {
  if (
    !congregationId.value ||
    !files.value.length ||
    files.value.length > 20 ||
    files.value.some((file) => file.size > 15 * 1024 * 1024)
  ) {
    error.value = t('memberImport.uploadRules');
    return;
  }
  busy.value = true;
  error.value = '';
  let batchId = '';
  try {
    const batch = await $fetch<{ id: string }>('/api/member-imports', {
      method: 'POST',
      body: { congregationId: congregationId.value },
    });
    batchId = batch.id;
    await files.value.reduce(async (previous, file, index) => {
      await previous;
      progress.value = `${index + 1}/${files.value.length}`;
      const form = new FormData();
      form.append('file', file);
      await $fetch(`/api/member-imports/${batchId}/items`, { method: 'POST', body: form });
    }, Promise.resolve());
    await navigateTo(`/members/import/${batchId}`);
  } catch {
    error.value = t('memberImport.uploadError');
    if (batchId) await refresh();
  } finally {
    busy.value = false;
    progress.value = '';
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <NuxtLink to="/members" class="text-sm underline">{{ $t('common.back') }}</NuxtLink>
    <div>
      <h1 class="text-2xl font-bold">{{ $t('memberImport.title') }}</h1>
      <p class="text-sm text-muted-foreground">{{ $t('memberImport.description') }}</p>
    </div>
    <p v-if="!can('members', 'CREATE') || !can('members', 'UPDATE')" role="alert">
      {{ $t('memberImport.forbidden') }}
    </p>
    <template v-else>
      <p v-if="data && !data.enabled" class="rounded-lg border p-4" role="status">
        {{ $t('memberImport.disabled') }}
      </p>
      <form class="space-y-4 rounded-xl border p-5" @submit.prevent="upload">
        <label class="block space-y-2">
          <span class="text-sm font-medium">{{ $t('memberImport.defaultCongregation') }}</span>
          <select
            v-model="congregationId"
            required
            :disabled="busy"
            class="w-full rounded-md border bg-background p-2"
          >
            <option value="">{{ $t('memberImport.chooseCongregation') }}</option>
            <option v-for="entry in data?.congregations" :key="entry.id" :value="entry.id">
              {{ entry.name }}
            </option>
          </select>
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium">{{ $t('memberImport.forms') }}</span>
          <input
            type="file"
            multiple
            accept=".heic,.heif,.jpg,.jpeg,.png,.webp"
            :disabled="busy"
            class="block w-full text-sm"
            @change="pickFiles"
          />
        </label>
        <p class="text-xs text-muted-foreground">{{ $t('memberImport.uploadRules') }}</p>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" :disabled="busy || !data?.enabled">{{
          busy ? `${$t('memberImport.uploading')} ${progress}` : $t('memberImport.start')
        }}</Button>
      </form>
      <div class="space-y-3">
        <h2 class="text-lg font-semibold">{{ $t('memberImport.history') }}</h2>
        <p v-if="!data?.batches.length" class="text-sm text-muted-foreground">
          {{ $t('memberImport.noBatches') }}
        </p>
        <NuxtLink
          v-for="batch in data?.batches"
          :key="batch.id"
          :to="`/members/import/${batch.id}`"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4 hover:bg-muted"
        >
          <span
            >{{ new Date(batch.createdAt).toLocaleString() }} ·
            {{ data?.congregations.find((entry) => entry.id === batch.congregationId)?.name }}</span
          >
          <span class="text-sm"
            >{{ batch.items.filter((item) => item.status === 'IMPORTED').length }}/{{
              batch.items.length
            }}
            {{ $t('memberImport.imported') }}</span
          >
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
