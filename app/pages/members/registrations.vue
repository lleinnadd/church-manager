<script setup lang="ts">
import { MemberStatus } from '@prisma/client';
import { toast } from 'vue-sonner';
import { memberRegistrationFields } from '#shared/validation/member';
import type { MemberFormData, MemberFormPayload } from '@/types/forms';

definePageMeta({
  middleware: ['rbac'],
  requiredPermission: { resource: 'members', action: 'READ' },
});
const { t, locale } = useI18n();
const { can } = usePermissions();
interface Registration {
  id: string;
  memberId: string | null;
  congregationId: string;
  status: 'OPEN' | 'PENDING' | 'APPROVED';
  updatedAt: string;
  submission: MemberFormData;
  photoUrl: string | null;
  member: (MemberFormData & { updatedAt: string }) | null;
  decisions: {
    action: string;
    at: string;
    by: string;
    reason?: string;
    photoUrl?: string;
    submission: Record<string, unknown>;
    approvedSubmission?: Record<string, unknown>;
  }[];
}
const { data: requests, refresh, status } = useFetch<Registration[]>('/api/member-registrations');
const { data: congregations } = useFetch<{ id: string; name: string }[]>('/api/congregations');
const selected = ref<Registration | null>(null);
const congregationId = ref('');
const reason = ref('');
const expiresAt = ref('');
const busy = ref(false);
const detailLoading = ref(false);
const canReview = computed(
  () => selected.value && can('members', selected.value.memberId ? 'UPDATE' : 'CREATE'),
);
const initialData = computed<MemberFormData | undefined>(() =>
  selected.value
    ? {
        ...selected.value.submission,
        photoUrl: selected.value.photoUrl,
        nameLocked: Boolean(selected.value.member?.clerkUserId),
        congregationId: selected.value.congregationId,
        status: MemberStatus.ACTIVE,
      }
    : undefined,
);
async function inspect(id: string) {
  detailLoading.value = true;
  selected.value = null;
  try {
    selected.value = await $fetch<Registration>(`/api/member-registrations/${id}`);
    congregationId.value = selected.value.congregationId;
    reason.value = '';
    const deadline = new Date(Date.now() + 48 * 3600000);
    expiresAt.value = new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  } catch {
    toast.error(t('common.errorGeneric'));
  } finally {
    detailLoading.value = false;
  }
}
async function decide(action: 'APPROVE' | 'RETURN', values?: MemberFormPayload) {
  if (!selected.value || busy.value) return;
  if (
    action === 'RETURN' &&
    (!reason.value.trim() || !expiresAt.value || new Date(expiresAt.value).getTime() <= Date.now())
  ) {
    toast.error(t('registration.returnInvalid'));
    return;
  }
  const reviewId = selected.value.id;
  busy.value = true;
  try {
    const body =
      action === 'RETURN'
        ? {
            action,
            updatedAt: selected.value.updatedAt,
            reason: reason.value,
            expiresAt: new Date(expiresAt.value).toISOString(),
          }
        : {
            action,
            updatedAt: selected.value.updatedAt,
            memberUpdatedAt: selected.value.member?.updatedAt ?? null,
            congregationId: congregationId.value,
            submission: Object.fromEntries(
              Object.keys(memberRegistrationFields).map((key) => [
                key,
                values?.[key as keyof MemberFormPayload],
              ]),
            ),
          };
    await $fetch(`/api/member-registrations/${selected.value.id}`, { method: 'POST', body });
    toast.success(t('registration.decisionSaved'));
    await inspect(reviewId);
    await refresh();
  } catch (error) {
    toast.error(
      t(
        (error as { statusCode?: number }).statusCode === 409
          ? 'registration.reviewConflict'
          : 'common.errorGeneric',
      ),
    );
  } finally {
    busy.value = false;
  }
}
function display(value: unknown) {
  return value == null || value === '' ? '—' : String(value);
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">{{ $t('registration.reviewQueue') }}</h1>
      <Button as-child variant="outline"
        ><NuxtLink to="/members">{{ $t('common.back') }}</NuxtLink></Button
      >
    </div>
    <p v-if="status === 'pending' || detailLoading">{{ $t('common.loading') }}</p>
    <div v-if="!selected" class="space-y-3">
      <p v-if="status === 'success' && !requests?.length">{{ $t('registration.noSubmissions') }}</p>
      <Button v-if="status === 'error'" @click="refresh()">{{ $t('registration.reload') }}</Button>
      <button
        v-for="request in requests"
        :key="request.id"
        class="flex w-full items-center justify-between rounded-lg border p-4 text-left"
        @click="inspect(request.id)"
      >
        <span>{{ request.submission?.name }}</span
        ><Badge>{{ $t(`registration.status${request.status}`) }}</Badge>
      </button>
    </div>
    <template v-if="selected && initialData">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="outline" @click="selected = null">{{ $t('common.back') }}</Button>
        <Badge>{{ $t(`registration.status${selected.status}`) }}</Badge>
        <Button variant="outline" @click="inspect(selected.id)">{{
          $t('registration.reload')
        }}</Button>
      </div>
      <img
        v-if="selected.photoUrl && selected.status !== 'PENDING'"
        :src="selected.photoUrl"
        :alt="$t('form.member.photo')"
        class="h-48 w-36 rounded-md object-cover"
      />
      <details v-if="selected.member" class="rounded-lg border p-4">
        <summary>{{ $t('registration.compare') }}</summary>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr>
                <th>{{ $t('registration.field') }}</th>
                <th>{{ $t('registration.current') }}</th>
                <th>{{ $t('registration.submitted') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="field in Object.keys(memberRegistrationFields)" :key="field">
                <td class="p-2">{{ $t(`form.member.${field}`) }}</td>
                <td class="p-2">{{ display(selected.member[field as keyof MemberFormData]) }}</td>
                <td class="p-2">
                  {{ display(selected.submission[field as keyof MemberFormData]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
      <template v-if="selected.status === 'PENDING' && canReview">
        <Label for="review-congregation">{{ $t('form.member.congregation') }}</Label>
        <select
          id="review-congregation"
          v-model="congregationId"
          :disabled="busy"
          class="w-full rounded-md border bg-background p-2"
        >
          <option v-for="item in congregations" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
        </select>
        <MemberForm
          :key="selected.updatedAt"
          :initial-data="initialData"
          public-mode
          photo-read-only
          :loading="busy"
          :submit-label="$t('registration.approve')"
          @submit="(values) => decide('APPROVE', values)"
        />
        <form class="space-y-3 rounded-lg border p-4" @submit.prevent="decide('RETURN')">
          <Label for="correction-reason">{{ $t('registration.correctionReason') }}</Label>
          <Textarea id="correction-reason" v-model="reason" required :disabled="busy" />
          <Label for="correction-deadline">{{ $t('registration.expiration') }}</Label>
          <Input
            id="correction-deadline"
            v-model="expiresAt"
            type="datetime-local"
            required
            :disabled="busy"
          />
          <Button type="submit" variant="outline" :disabled="busy">{{
            $t('registration.return')
          }}</Button>
        </form>
      </template>
      <details
        v-for="(decision, index) in selected.decisions"
        :key="index"
        class="rounded-lg border p-4"
      >
        <summary>
          {{ $t(decision.action === 'RETURN' ? 'registration.return' : 'registration.approve') }} ·
          {{ new Date(decision.at).toLocaleString(locale) }}
        </summary>
        <p class="my-2 text-sm">{{ decision.by }} · {{ decision.reason }}</p>
        <img
          v-if="decision.photoUrl"
          :src="decision.photoUrl"
          :alt="$t('form.member.photo')"
          class="my-3 h-48 w-36 rounded-md object-cover"
        />
        <dl class="grid gap-2 text-sm sm:grid-cols-2">
          <template
            v-for="(value, field) in decision.approvedSubmission || decision.submission"
            :key="field"
            ><dt>{{ $t(`form.member.${field}`) }}</dt>
            <dd>{{ display(value) }}</dd></template
          >
        </dl>
      </details>
    </template>
  </div>
</template>
