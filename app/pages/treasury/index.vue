<script setup lang="ts">
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings,
  FileBarChart,
  CalendarIcon,
  MoreVertical,
  Paperclip,
} from '@lucide/vue';
import { toast } from 'vue-sonner';
import type { AcceptableValue } from 'reka-ui';
import type { Congregation } from '@prisma/client';
import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
import type { TransactionFormData, TransactionFormPayload } from '@/types/forms';
import { formatDateTimeLocal } from '@/lib/utils';

const { t, locale } = useI18n();
const { timezone } = useTimezone();
const { formatBRL } = useCurrencyInput();

const now = new Date();
const startDate = ref(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
const endDate = ref(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
const filterCongregationId = ref<string>('');
const filterType = ref<string>('');

const { data: congregations } = useFetch<Congregation[]>('/api/congregations');

const NO_FILTER_VALUE = '__all__';

watch(
  congregations,
  (list) => {
    if (!filterCongregationId.value && list?.length) {
      filterCongregationId.value = list[0]!.id;
    }
  },
  { immediate: true },
);

const {
  data: dailyData,
  status,
  refresh,
} = useFetch<{
  carryOverBalance: number;
  dailySummaries: {
    date: string;
    income: number;
    expense: number;
    balance: number;
    transactions: TransactionFormData[];
  }[];
}>('/api/transactions/daily-summary', {
  query: computed(() => ({
    startDate: startDate.value,
    endDate: endDate.value,
    congregationId: filterCongregationId.value || undefined,
  })),
  watch: [startDate, endDate, filterCongregationId],
});

const isLoading = computed(() => status.value === 'pending');

const filteredDailySummaries = computed(() => {
  if (!dailyData.value?.dailySummaries) return [];
  if (!filterType.value) return dailyData.value.dailySummaries;
  return dailyData.value.dailySummaries
    .map((day) => ({
      ...day,
      transactions: day.transactions.filter((tx) => tx.type === filterType.value),
    }))
    .filter((day) => day.transactions.length > 0);
});

const periodTotals = computed(() => {
  if (!dailyData.value?.dailySummaries) return { income: 0, expense: 0, balance: 0 };
  let totalIncome = 0;
  let totalExpense = 0;
  dailyData.value.dailySummaries.forEach((day) => {
    totalIncome += day.income;
    totalExpense += day.expense;
  });
  const lastDay = dailyData.value.dailySummaries[dailyData.value.dailySummaries.length - 1];
  return {
    income: totalIncome,
    expense: totalExpense,
    balance: lastDay?.balance ?? dailyData.value.carryOverBalance,
  };
});

const deleteTarget = ref<{ id: string; name: string } | null>(null);
const isDeleting = ref(false);

function confirmDelete(id: string, name: string) {
  deleteTarget.value = { id, name };
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/transactions/${deleteTarget.value.id}` as '/api/transactions/:id', {
      method: 'DELETE',
    });
    toast.success(t('pages.treasury.deleteSuccess'));
    await refresh();
  } catch {
    toast.error(t('pages.treasury.deleteError'));
  } finally {
    isDeleting.value = false;
    deleteTarget.value = null;
  }
}

function formatDate(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone.value,
  }).format(date);
}

function parseDateStringToDateValue(value?: string | null): DateValue | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new CalendarDate(year, month, day);
}

function formatDateDisplay(value: DateValue | undefined): string {
  if (!value) return '';
  return value.toDate(getLocalTimeZone()).toLocaleDateString(locale.value);
}

function toDateString(value: DateValue | undefined): string {
  if (!value) return '';
  return value.toString();
}

const sheetOpen = ref(false);
const sheetLoading = ref(false);
const editingTransaction = ref<TransactionFormData | undefined>(undefined);

const sheetTitle = computed(() =>
  editingTransaction.value ? t('pages.treasury.editTitle') : t('pages.treasury.new'),
);
const sheetDescription = computed(() =>
  editingTransaction.value
    ? t('pages.treasury.editDescription')
    : t('pages.treasury.newDescription'),
);

function openCreateSheet() {
  editingTransaction.value = undefined;
  sheetOpen.value = true;
}

async function openEditSheet(txId: string) {
  try {
    const tx = await $fetch<TransactionFormData>(`/api/transactions/${txId}`);
    editingTransaction.value = {
      ...tx,
      date: formatDateTimeLocal(tx.date),
    };
    sheetOpen.value = true;
  } catch {
    toast.error(t('pages.treasury.loadError'));
  }
}

async function handleSheetSubmit(data: TransactionFormPayload, files: File[]) {
  sheetLoading.value = true;
  try {
    if (editingTransaction.value?.id) {
      await $fetch(`/api/transactions/${editingTransaction.value.id}` as '/api/transactions/:id', {
        method: 'PUT',
        body: data,
      });
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        await $fetch(`/api/transactions/${editingTransaction.value.id}/attachments`, {
          method: 'POST',
          body: formData,
        });
      }
      toast.success(t('pages.treasury.updateSuccess'));
    } else {
      const transaction = await $fetch<{ id: string }>('/api/transactions', {
        method: 'POST',
        body: data,
      });
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        await $fetch(`/api/transactions/${transaction.id}/attachments`, {
          method: 'POST',
          body: formData,
        });
      }
      toast.success(t('pages.treasury.createSuccess'));
    }
    sheetOpen.value = false;
    editingTransaction.value = undefined;
    await refresh();
  } catch {
    toast.error(
      editingTransaction.value?.id
        ? t('pages.treasury.updateError')
        : t('pages.treasury.createError'),
    );
  } finally {
    sheetLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.treasury.title') }}</h1>
        <p class="text-muted-foreground text-sm">{{ $t('pages.treasury.description') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/treasury/reports">
            <FileBarChart class="mr-2 size-4" />
            {{ $t('pages.treasury.reports') }}
          </NuxtLink>
        </Button>
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/treasury/settings">
            <Settings class="mr-2 size-4" />
            {{ $t('pages.treasury.settings') }}
          </NuxtLink>
        </Button>
        <Button size="sm" @click="openCreateSheet">
          <Plus class="mr-2 size-4" />
          {{ $t('pages.treasury.new') }}
        </Button>
      </div>
    </div>

    <Card class="py-0">
      <CardContent
        class="grid grid-cols-2 gap-3 px-4 py-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4"
      >
        <div class="space-y-1">
          <Label>{{ $t('pages.treasury.startDate') }}</Label>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                type="button"
                variant="outline"
                :class="[
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground',
                ]"
              >
                <CalendarIcon class="mr-2 size-4" />
                {{
                  startDate
                    ? formatDateDisplay(parseDateStringToDateValue(startDate))
                    : $t('common.pickADate')
                }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="parseDateStringToDateValue(startDate)"
                layout="month-and-year"
                @update:model-value="(v) => (startDate = toDateString(v as DateValue))"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div class="space-y-1">
          <Label>{{ $t('pages.treasury.endDate') }}</Label>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                type="button"
                variant="outline"
                :class="[
                  'w-full justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground',
                ]"
              >
                <CalendarIcon class="mr-2 size-4" />
                {{
                  endDate
                    ? formatDateDisplay(parseDateStringToDateValue(endDate))
                    : $t('common.pickADate')
                }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="parseDateStringToDateValue(endDate)"
                layout="month-and-year"
                @update:model-value="(v) => (endDate = toDateString(v as DateValue))"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div class="space-y-1">
          <Label>{{ $t('pages.treasury.filterCongregation') }}</Label>
          <Select
            :model-value="filterCongregationId"
            @update:model-value="(v: AcceptableValue) => (filterCongregationId = v as string)"
          >
            <SelectTrigger class="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in congregations || []" :key="c.id" :value="c.id">
                {{ c.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1">
          <Label>{{ $t('pages.treasury.filterType') }}</Label>
          <Select
            :model-value="filterType || NO_FILTER_VALUE"
            @update:model-value="
              (v: AcceptableValue) => (filterType = v === NO_FILTER_VALUE ? '' : (v as string))
            "
          >
            <SelectTrigger class="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NO_FILTER_VALUE">{{ $t('common.all') }}</SelectItem>
              <SelectItem value="INCOME">{{ $t('form.transaction.income') }}</SelectItem>
              <SelectItem value="EXPENSE">{{ $t('form.transaction.expense') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>

    <div class="grid gap-4 md:grid-cols-3">
      <Card class="py-0">
        <CardContent class="px-4 py-3">
          <p class="text-sm text-muted-foreground">{{ $t('pages.treasury.totalIncome') }}</p>
          <div class="mt-1 text-2xl font-bold text-green-600">
            {{ formatBRL(periodTotals.income) }}
          </div>
        </CardContent>
      </Card>
      <Card class="py-0">
        <CardContent class="px-4 py-3">
          <p class="text-sm text-muted-foreground">{{ $t('pages.treasury.totalExpense') }}</p>
          <div class="mt-1 text-2xl font-bold text-red-600">
            {{ formatBRL(periodTotals.expense) }}
          </div>
        </CardContent>
      </Card>
      <Card class="py-0">
        <CardContent class="px-4 py-3">
          <p class="text-sm text-muted-foreground">{{ $t('pages.treasury.currentBalance') }}</p>
          <div
            class="mt-1 text-2xl font-bold"
            :class="periodTotals.balance >= 0 ? 'text-green-600' : 'text-red-600'"
          >
            {{ formatBRL(periodTotals.balance) }}
          </div>
        </CardContent>
      </Card>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <Skeleton v-for="i in 3" :key="i" class="h-24 w-full rounded-xl" />
    </div>

    <Empty v-else-if="!filteredDailySummaries.length" class="min-h-60">
      <EmptyMedia variant="icon">
        <Wallet class="size-8" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{{ $t('pages.treasury.emptyTitle') }}</EmptyTitle>
        <EmptyDescription>{{ $t('pages.treasury.emptyDescription') }}</EmptyDescription>
      </EmptyHeader>
    </Empty>

    <div v-else class="space-y-4">
      <div
        class="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2 text-sm"
      >
        <span class="text-muted-foreground">{{ $t('pages.treasury.carryOver') }}</span>
        <span
          class="font-semibold tabular-nums"
          :class="(dailyData?.carryOverBalance ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'"
        >
          {{ formatBRL(dailyData?.carryOverBalance ?? 0) }}
        </span>
      </div>

      <Card
        v-for="day in filteredDailySummaries"
        :key="day.date"
        class="py-0 gap-0 overflow-hidden"
      >
        <div
          class="flex flex-col gap-1 bg-muted/40 px-4 py-2.5 border-b sm:flex-row sm:items-center sm:justify-between"
        >
          <span class="text-sm font-semibold capitalize">{{ formatDate(day.date) }}</span>
          <div class="flex items-center gap-2 text-xs tabular-nums">
            <span v-if="day.income > 0" class="text-green-600">+{{ formatBRL(day.income) }}</span>
            <span v-if="day.expense > 0" class="text-red-600">-{{ formatBRL(day.expense) }}</span>
            <Badge
              :variant="day.balance >= 0 ? 'default' : 'destructive'"
              class="tabular-nums text-xs px-2 py-0.5 ml-auto sm:ml-0"
            >
              {{ formatBRL(day.balance) }}
            </Badge>
          </div>
        </div>

        <div class="divide-y">
          <div
            v-for="tx in day.transactions"
            :key="tx.id"
            class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/20 transition-colors"
          >
            <div
              class="flex size-8 shrink-0 items-center justify-center rounded-full"
              :class="tx.type === 'INCOME' ? 'bg-green-500/10' : 'bg-red-500/10'"
            >
              <ArrowUpCircle v-if="tx.type === 'INCOME'" class="size-4 text-green-600" />
              <ArrowDownCircle v-else class="size-4 text-red-600" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-medium truncate">{{ tx.name }}</span>
                <Badge
                  v-if="tx.category"
                  variant="secondary"
                  class="text-[10px] shrink-0 leading-tight"
                >
                  {{ tx.category.name }}
                </Badge>
              </div>
              <div class="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{{ formatTime(tx.date) }}</span>
                <template v-if="tx.congregation">
                  <span>·</span>
                  <span>{{ tx.congregation.name }}</span>
                </template>
                <template v-if="tx.attachments?.length">
                  <span>·</span>
                  <span class="flex items-center gap-0.5">
                    <Paperclip class="size-3" />
                    {{ tx.attachments.length }}
                  </span>
                </template>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                class="font-semibold tabular-nums text-sm"
                :class="tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'"
              >
                {{ tx.type === 'INCOME' ? '+' : '-' }}{{ formatBRL(tx.amount) }}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-7">
                    <MoreVertical class="size-4" />
                    <span class="sr-only">{{ $t('common.actions') }}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @select="openEditSheet(tx.id!)">
                    <Pencil class="mr-2 size-4" />
                    {{ $t('common.edit') }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="text-destructive"
                    @select="confirmDelete(tx.id!, tx.name)"
                  >
                    <Trash2 class="mr-2 size-4" />
                    {{ $t('common.delete') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <ConfirmDialog
      :open="!!deleteTarget"
      :title="$t('pages.treasury.deleteTitle')"
      :description="$t('pages.treasury.deleteDescription', { name: deleteTarget?.name })"
      :loading="isDeleting"
      @confirm="handleDelete"
      @cancel="deleteTarget = null"
    />

    <Sheet v-model:open="sheetOpen">
      <SheetContent side="right" class="w-full sm:max-w-xl overflow-y-auto px-4 py-6 sm:px-6">
        <SheetHeader class="p-0">
          <SheetTitle>{{ sheetTitle }}</SheetTitle>
          <SheetDescription>{{ sheetDescription }}</SheetDescription>
        </SheetHeader>
        <TransactionForm
          :key="editingTransaction?.id ?? 'new'"
          :initial-data="editingTransaction"
          :loading="sheetLoading"
          @submit="handleSheetSubmit"
          @cancel="sheetOpen = false"
        />
      </SheetContent>
    </Sheet>
  </div>
</template>
