<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ImportCandidate, ImportItemView } from '#shared/types/member-import';
import {
  comparableImportValue,
  importFields,
  type ImportDraft,
  type ImportField,
} from '#shared/validation/member-import';

const props = defineProps<{
  item: ImportItemView;
  batchId: string;
  congregations: { id: string; name: string }[];
  selected: boolean;
}>();
const emit = defineEmits<{
  refresh: [];
  select: [id: string, selected: boolean];
  editing: [id: string];
}>();
const { t } = useI18n();
const draft = ref<ImportDraft | null>(
  props.item.draft ? structuredClone(toRaw(props.item.draft)) : null,
);
const candidates = ref<ImportCandidate[]>(props.item.candidates);
const search = ref('');
const busy = ref(false);
const dirty = ref(false);
const message = ref('');
const fieldErrors = ref<Partial<Record<ImportField, string>>>({});
const blocked = ref(props.item.blocked);
const existing = computed(() =>
  candidates.value.find((entry) => entry.id === draft.value?.memberId),
);
const base = computed(() => `/api/member-imports/${props.batchId}/items/${props.item.id}`);
const labels: Partial<Record<ImportField, string>> = {
  name: 'name',
  observations: 'observations',
  congregationId: 'congregation',
  status: 'status',
};
const label = (field: ImportField) =>
  t(`form.member.${labels[field] || field}`).replace(/\s*\*$/, '');
const display = (field: ImportField, value: string | undefined) => {
  if (field === 'congregationId')
    return props.congregations.find((entry) => entry.id === value)?.name || value || '—';
  return value || '—';
};
watch(
  () => props.item.revision,
  () => {
    draft.value = props.item.draft ? structuredClone(toRaw(props.item.draft)) : null;
    candidates.value = props.item.candidates;
    blocked.value = props.item.blocked;
    dirty.value = false;
  },
);
function edit() {
  dirty.value = true;
  if (draft.value) draft.value.approved = false;
  emit('editing', props.item.id);
}
function chooseTarget(event: Event) {
  if (!draft.value) return;
  const id = (event.target as HTMLSelectElement).value;
  edit();
  draft.value.decisions = {};
  if (id === 'new') draft.value.target = 'new';
  else draft.value.target = id ? 'existing' : null;
  const member = candidates.value.find((entry) => entry.id === id);
  draft.value.memberId = member?.id || null;
  draft.value.memberUpdatedAt = member?.updatedAt || null;
  if (id === 'new' && !draft.value.values.status) draft.value.values.status = 'ACTIVE';
}
function hasConflict(field: ImportField) {
  const previous = existing.value?.values[field];
  const next = draft.value?.values[field];
  return Boolean(
    previous &&
    next &&
    comparableImportValue(field, previous) !== comparableImportValue(field, next),
  );
}
async function searchMembers() {
  if (!draft.value) return;
  busy.value = true;
  try {
    const response = await $fetch<{ candidates: ImportCandidate[]; blocked: boolean }>(
      `${base.value}/matches`,
      { method: 'POST', body: { values: draft.value.values, search: search.value } },
    );
    const selected = existing.value;
    candidates.value = response.candidates;
    if (selected && !candidates.value.some((entry) => entry.id === selected.id))
      candidates.value.push(selected);
    blocked.value = response.blocked;
  } catch {
    message.value = t('memberImport.requestError');
  } finally {
    busy.value = false;
  }
}
async function save(approved: boolean) {
  if (!draft.value) return;
  busy.value = true;
  message.value = '';
  fieldErrors.value = {};
  try {
    await $fetch(base.value, {
      method: 'PUT',
      body: { revision: props.item.revision, draft: { ...draft.value, approved } },
    });
    emit('refresh');
  } catch (error) {
    const details = (
      error as {
        data?: { data?: { code?: string; fields?: Partial<Record<ImportField, string>> } };
      }
    ).data?.data;
    fieldErrors.value = details?.fields || {};
    message.value = details?.code
      ? t(`memberImport.errors.${details.code}`)
      : t('memberImport.requestError');
  } finally {
    busy.value = false;
  }
}
async function retry() {
  busy.value = true;
  try {
    await $fetch(`${base.value}/retry`, { method: 'POST' });
    emit('refresh');
  } catch {
    message.value = t('memberImport.requestError');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <article class="space-y-4 rounded-xl border p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-semibold break-all">{{ item.fileName }}</h2>
        <p class="text-xs text-muted-foreground">{{ $t(`memberImport.states.${item.status}`) }}</p>
      </div>
      <label v-if="item.status === 'REVIEW_READY'" class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="selected"
          :disabled="!item.draft?.approved || dirty || busy"
          @change="emit('select', item.id, ($event.target as HTMLInputElement).checked)"
        />
        {{ $t('memberImport.selectForSave') }}
      </label>
      <NuxtLink
        v-if="item.savedMemberId"
        :to="`/members/${item.savedMemberId}/edit`"
        class="text-sm underline"
        >{{ $t(`memberImport.results.${item.result}`) }}</NuxtLink
      >
    </div>
    <div class="grid gap-6 xl:grid-cols-2">
      <div class="space-y-2">
        <a :href="item.sourceUrl" target="_blank" rel="noopener"
          ><img
            :src="item.sourceUrl"
            :alt="$t('memberImport.formPreview')"
            class="max-h-[800px] w-full rounded-md border object-contain"
            loading="lazy"
        /></a>
        <a :href="`${item.sourceUrl}?original=true`" class="text-xs underline">{{
          $t('memberImport.downloadOriginal')
        }}</a>
      </div>
      <div v-if="item.status === 'REVIEW_READY' && draft" class="space-y-4">
        <p v-if="blocked" class="text-sm text-destructive" role="alert">
          {{ $t('memberImport.errors.MATCH_UNAVAILABLE') }}
        </p>
        <label class="block space-y-1">
          <span class="text-sm font-medium">{{ $t('memberImport.target') }}</span>
          <select
            :value="draft.target === 'new' ? 'new' : draft.memberId || ''"
            :disabled="busy"
            class="w-full rounded-md border bg-background p-2"
            @change="chooseTarget"
          >
            <option value="">{{ $t('memberImport.chooseTarget') }}</option>
            <option value="new">{{ $t('memberImport.createNew') }}</option>
            <option v-for="entry in candidates" :key="entry.id" :value="entry.id">
              #{{ entry.memberNumber }} · {{ entry.name }} ·
              {{ $t(`memberImport.match.${entry.reason}`)
              }}{{ entry.contradiction ? ` · ${$t('memberImport.identityConflict')}` : '' }}
            </option>
          </select>
        </label>
        <div class="flex gap-2">
          <Input
            v-model="search"
            :aria-label="$t('memberImport.search')"
            :placeholder="$t('memberImport.search')"
            @keydown.enter.prevent="searchMembers"
          />
          <Button variant="outline" :disabled="busy" @click="searchMembers">{{
            $t('memberImport.findMatches')
          }}</Button>
        </div>
        <p class="text-xs text-muted-foreground">{{ $t('memberImport.preserveHint') }}</p>
        <div v-for="field in importFields" :key="field" class="space-y-2 border-t pt-3">
          <label :for="`${item.id}-${field}`" class="text-sm font-medium">{{ label(field) }}</label>
          <p v-if="existing" class="text-xs text-muted-foreground">
            {{ $t('memberImport.existing') }}: {{ display(field, existing.values[field]) }}
          </p>
          <p v-if="item.extraction?.raw[field]" class="text-xs text-muted-foreground">
            {{ $t('memberImport.transcription') }}: {{ item.extraction.raw[field] }}
          </p>
          <select
            v-if="field === 'congregationId'"
            :id="`${item.id}-${field}`"
            v-model="draft.values[field]"
            :disabled="busy"
            class="w-full rounded-md border bg-background p-2"
            @change="edit"
          >
            <option v-for="entry in congregations" :key="entry.id" :value="entry.id">
              {{ entry.name }}
            </option>
          </select>
          <select
            v-else-if="field === 'status' || field === 'maritalStatus'"
            :id="`${item.id}-${field}`"
            v-model="draft.values[field]"
            :disabled="busy"
            class="w-full rounded-md border bg-background p-2"
            @change="edit"
          >
            <option value="">—</option>
            <option
              v-for="value in field === 'status'
                ? ['ACTIVE', 'TRANSFERRED', 'WITHDRAWN']
                : ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED']"
              :key="value"
              :value="value"
            >
              {{
                $t(
                  `members.${field === 'status' ? 'status' : 'maritalStatus'}.${value.toLowerCase()}`,
                )
              }}
            </option>
          </select>
          <Input
            v-else
            :id="`${item.id}-${field}`"
            v-model="draft.values[field]"
            :disabled="busy || Boolean(field === 'name' && existing?.clerkUserId)"
            :placeholder="
              ['dateOfBirth', 'memberSince', 'baptismDate', 'convertionDate'].includes(field)
                ? 'YYYY-MM-DD'
                : ''
            "
            @update:model-value="edit"
          />
          <p v-if="field === 'name' && existing?.clerkUserId" class="text-xs text-muted-foreground">
            {{ $t('memberImport.nameLocked') }}
          </p>
          <label class="flex flex-wrap items-center gap-2 text-xs">
            <span>{{ $t('memberImport.decision') }}</span>
            <select
              v-model="draft.decisions[field]"
              :disabled="busy"
              class="rounded border bg-background p-1"
              @change="edit"
            >
              <option :value="undefined">
                {{
                  hasConflict(field)
                    ? $t('memberImport.resolveConflict')
                    : $t('memberImport.fillGap')
                }}
              </option>
              <option v-if="existing" value="keep">{{ $t('memberImport.keepExisting') }}</option>
              <option value="use">{{ $t('memberImport.useForm') }}</option>
              <option value="omit">{{ $t('memberImport.omit') }}</option>
            </select>
          </label>
          <label
            v-if="item.extraction?.warnings[field]"
            class="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"
          >
            <input
              v-model="draft.confirmedWarnings"
              type="checkbox"
              :value="field"
              :disabled="busy"
              @change="edit"
            />
            <span
              >{{ $t(`memberImport.warnings.${item.extraction.warnings[field]}`) }}
              {{ $t('memberImport.confirmField') }}</span
            >
          </label>
          <p v-if="fieldErrors[field]" class="text-xs text-destructive">
            {{ $t(`memberImport.warnings.${fieldErrors[field]}`) }}
          </p>
        </div>
        <p v-if="item.extraction?.raw.functionTitle" class="rounded-md bg-muted p-3 text-sm">
          {{ $t('memberImport.titleNote') }}: {{ item.extraction.raw.functionTitle }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" :disabled="busy" @click="save(false)">{{
            $t('memberImport.saveDraft')
          }}</Button>
          <Button :disabled="busy || blocked || !draft.target" @click="save(true)">{{
            $t('memberImport.approve')
          }}</Button>
        </div>
      </div>
      <div v-else class="space-y-3">
        <p v-if="item.errorCode" class="text-sm text-destructive">
          {{ $t(`memberImport.errors.${item.errorCode}`) }}
        </p>
        <Button v-if="item.status === 'FAILED'" :disabled="busy" @click="retry">{{
          $t('memberImport.retry')
        }}</Button>
        <p v-if="item.status === 'IMPORTED'" class="text-sm">{{ $t('memberImport.savedHint') }}</p>
      </div>
    </div>
    <p v-if="message" role="alert" class="text-sm text-destructive">{{ message }}</p>
  </article>
</template>
