<script setup lang="ts">
import { Button } from '@/components/ui/button';
import type { ImportBatchView } from '#shared/types/member-import';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'members', action: 'READ' },
});
const route = useRoute();
const { t } = useI18n();
const batchId = String(route.params.id);
const {
  data: batch,
  refresh,
  error: loadError,
} = await useFetch<ImportBatchView>(`/api/member-imports/${batchId}`);
const { data: directory } = await useFetch<{ congregations: { id: string; name: string }[] }>(
  '/api/member-imports',
);
const selected = ref<string[]>([]);
const busy = ref(false);
const deleteOpen = ref(false);
const error = ref('');
const results = ref<{ name: string; result: string }[]>([]);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    if (!busy.value) refresh();
  }, 3000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
function select(id: string, checked: boolean) {
  selected.value = selected.value.filter((value) => value !== id);
  if (checked) selected.value.push(id);
}
async function saveSelected() {
  busy.value = true;
  results.value = [];
  try {
    await selected.value.reduce(async (previous, id) => {
      await previous;
      const item = batch.value?.items.find((entry) => entry.id === id);
      if (!item?.draft?.approved || item.status !== 'REVIEW_READY') return;
      try {
        const response = await $fetch<{ result: string }>(
          `/api/member-imports/${batchId}/items/${id}/commit`,
          { method: 'POST', body: { revision: item.revision } },
        );
        results.value.push({ name: item.fileName, result: response.result });
      } catch {
        results.value.push({ name: item.fileName, result: 'failed' });
      }
    }, Promise.resolve());
    selected.value = [];
    await refresh();
  } finally {
    busy.value = false;
  }
}
async function removeBatch() {
  busy.value = true;
  try {
    await $fetch(`/api/member-imports/${batchId}`, { method: 'DELETE' });
    await navigateTo('/members/import');
  } catch {
    error.value = t('memberImport.requestError');
  } finally {
    busy.value = false;
    deleteOpen.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/members/import" class="text-sm underline">{{
      $t('memberImport.history')
    }}</NuxtLink>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">{{ $t('memberImport.reviewTitle') }}</h1>
        <p class="text-sm text-muted-foreground">{{ $t('memberImport.reviewHint') }}</p>
      </div>
      <div class="flex gap-2">
        <Button :disabled="busy || !selected.length" @click="saveSelected"
          >{{ $t('memberImport.saveSelected') }} ({{ selected.length }})</Button
        >
        <Button variant="outline" :disabled="busy" @click="deleteOpen = true">{{
          $t('memberImport.deleteBatch')
        }}</Button>
      </div>
    </div>
    <p v-if="loadError || error" class="text-sm text-destructive" role="alert">
      {{ error || $t('memberImport.requestError') }}
    </p>
    <ul v-if="results.length" class="space-y-1 rounded-md border p-4 text-sm" role="status">
      <li v-for="result in results" :key="result.name">
        {{ result.name }}: {{ $t(`memberImport.results.${result.result}`) }}
      </li>
    </ul>
    <p v-if="!batch?.items.length" class="text-sm text-muted-foreground">
      {{ $t('memberImport.noForms') }}
    </p>
    <MemberImportReview
      v-for="item in batch?.items"
      :key="item.id"
      :item="item"
      :batch-id="batchId"
      :congregations="directory?.congregations || []"
      :selected="selected.includes(item.id)"
      @select="select"
      @editing="select($event, false)"
      @refresh="refresh"
    />
    <ConfirmDialog
      :open="deleteOpen"
      :title="$t('memberImport.deleteBatch')"
      :description="$t('memberImport.deleteHint')"
      :confirm-label="$t('common.delete')"
      variant="destructive"
      :loading="busy"
      @confirm="removeBatch"
      @cancel="deleteOpen = false"
    />
  </div>
</template>
