<script setup lang="ts">
import { ChevronLeft, ChevronRight, Download, ArrowUpCircle, ArrowDownCircle } from '@lucide/vue';
import type { AcceptableValue } from 'reka-ui';
import type { Congregation } from '@prisma/client';

const { locale } = useI18n();
const { formatBRL } = useCurrencyInput();

const now = new Date();
const currentMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
const filterCongregationId = ref<string>('');

const { data: congregations } = useFetch<Congregation[]>('/api/congregations');

const { data: report, status } = useFetch<{
  month: string;
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpense: number;
  transactions: {
    name: string;
    type: string;
    amount: number;
    date: string;
    category?: { name: string } | null;
    congregation?: { name: string } | null;
  }[];
  dailySummaries: {
    date: string;
    income: number;
    expense: number;
    balance: number;
  }[];
  categorySummary: {
    categoryId: string | null;
    name: string;
    income: number;
    expense: number;
  }[];
}>('/api/transactions/monthly-report', {
  query: computed(() => ({
    month: currentMonth.value,
    congregationId: filterCongregationId.value || undefined,
  })),
  watch: [currentMonth, filterCongregationId],
});

const isLoading = computed(() => status.value === 'pending');

function navigateMonth(offset: number) {
  const [yearStr, monthStr] = currentMonth.value.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1 + offset, 1);
  currentMonth.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthDisplay(month: string) {
  const [yearStr, monthStr] = month.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  return new Intl.DateTimeFormat(locale.value, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(locale.value, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

const isExporting = ref(false);

async function exportPdf() {
  isExporting.value = true;
  try {
    const query = new URLSearchParams({
      month: currentMonth.value,
      locale: locale.value,
    });
    if (filterCongregationId.value) {
      query.set('congregationId', filterCongregationId.value);
    }

    const response = await $fetch<Blob>(
      `/api/transactions/monthly-report-export?${query.toString()}`,
      { responseType: 'blob' },
    );

    const url = URL.createObjectURL(response);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe-tesouraria-${currentMonth.value}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    // no-op
  } finally {
    isExporting.value = false;
  }
}

const NO_FILTER_VALUE = '__all__';
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.treasury.reportsTitle') }}</h1>
        <p class="text-muted-foreground text-sm">{{ $t('pages.treasury.reportsDescription') }}</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" as-child>
          <NuxtLink to="/treasury">{{ $t('common.back') }}</NuxtLink>
        </Button>
      </div>
    </div>

    <Card class="py-0">
      <CardContent
        class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4"
      >
        <div class="flex items-center gap-2">
          <Button variant="outline" size="icon" @click="navigateMonth(-1)">
            <ChevronLeft class="size-4" />
          </Button>
          <span
            class="flex-1 text-center text-lg font-semibold capitalize sm:min-w-40 sm:flex-none"
          >
            {{ formatMonthDisplay(currentMonth) }}
          </span>
          <Button variant="outline" size="icon" @click="navigateMonth(1)">
            <ChevronRight class="size-4" />
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <Select
            :model-value="filterCongregationId || NO_FILTER_VALUE"
            @update:model-value="
              (v: AcceptableValue) =>
                (filterCongregationId = v === NO_FILTER_VALUE ? '' : (v as string))
            "
          >
            <SelectTrigger class="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NO_FILTER_VALUE">{{ $t('common.all') }}</SelectItem>
              <SelectItem v-for="c in congregations || []" :key="c.id" :value="c.id">
                {{ c.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Button :disabled="isExporting" @click="exportPdf">
            <Download class="mr-2 size-4" />
            {{ $t('pages.treasury.exportPdf') }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <div v-if="isLoading" class="space-y-4">
      <Skeleton v-for="i in 4" :key="i" class="h-20 w-full rounded-xl" />
    </div>

    <template v-else-if="report">
      <div class="grid gap-4 md:grid-cols-4">
        <Card class="py-0">
          <CardContent class="px-4 py-3">
            <p class="text-sm text-muted-foreground">{{ $t('pages.treasury.openingBalance') }}</p>
            <div
              class="mt-1 text-xl font-bold"
              :class="report.openingBalance >= 0 ? 'text-green-600' : 'text-red-600'"
            >
              {{ formatBRL(report.openingBalance) }}
            </div>
          </CardContent>
        </Card>
        <Card class="py-0">
          <CardContent class="px-4 py-3">
            <p class="text-sm text-muted-foreground">{{ $t('pages.treasury.totalIncome') }}</p>
            <div class="mt-1 text-xl font-bold text-green-600">
              {{ formatBRL(report.totalIncome) }}
            </div>
          </CardContent>
        </Card>
        <Card class="py-0">
          <CardContent class="px-4 py-3">
            <p class="text-sm text-muted-foreground">{{ $t('pages.treasury.totalExpense') }}</p>
            <div class="mt-1 text-xl font-bold text-red-600">
              {{ formatBRL(report.totalExpense) }}
            </div>
          </CardContent>
        </Card>
        <Card class="py-0">
          <CardContent class="px-4 py-3">
            <p class="text-sm text-muted-foreground">{{ $t('pages.treasury.closingBalance') }}</p>
            <div
              class="mt-1 text-xl font-bold"
              :class="report.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'"
            >
              {{ formatBRL(report.closingBalance) }}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{{ $t('pages.treasury.transactionsTitle') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="!report.transactions.length" class="py-8 text-center text-muted-foreground">
            {{ $t('pages.treasury.noTransactions') }}
          </div>
          <div v-else class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ $t('pages.treasury.tableDate') }}</TableHead>
                  <TableHead>{{ $t('pages.treasury.tableName') }}</TableHead>
                  <TableHead>{{ $t('pages.treasury.tableCategory') }}</TableHead>
                  <TableHead>{{ $t('pages.treasury.tableType') }}</TableHead>
                  <TableHead class="text-right">{{ $t('pages.treasury.tableAmount') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(tx, index) in report.transactions" :key="index">
                  <TableCell>{{ formatDateTime(tx.date) }}</TableCell>
                  <TableCell>{{ tx.name }}</TableCell>
                  <TableCell>
                    <Badge v-if="tx.category" variant="outline">{{ tx.category.name }}</Badge>
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-1">
                      <ArrowUpCircle v-if="tx.type === 'INCOME'" class="size-4 text-green-600" />
                      <ArrowDownCircle v-else class="size-4 text-red-600" />
                      <span :class="tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'">
                        {{
                          tx.type === 'INCOME'
                            ? $t('form.transaction.income')
                            : $t('form.transaction.expense')
                        }}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    class="text-right font-medium tabular-nums"
                    :class="tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'"
                  >
                    {{ tx.type === 'INCOME' ? '+' : '-' }}{{ formatBRL(tx.amount) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card v-if="report.categorySummary.length">
        <CardHeader>
          <CardTitle>{{ $t('pages.treasury.categorySummary') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ $t('pages.treasury.tableCategory') }}</TableHead>
                  <TableHead class="text-right">{{ $t('form.transaction.income') }}</TableHead>
                  <TableHead class="text-right">{{ $t('form.transaction.expense') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="cat in report.categorySummary" :key="cat.categoryId ?? 'none'">
                  <TableCell>{{ cat.name }}</TableCell>
                  <TableCell class="text-right font-medium tabular-nums text-green-600">
                    {{ formatBRL(cat.income) }}
                  </TableCell>
                  <TableCell class="text-right font-medium tabular-nums text-red-600">
                    {{ formatBRL(cat.expense) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
