<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui';
import { CalendarIcon } from '@lucide/vue';
import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
import { toast } from 'vue-sonner';
import type { Congregation } from '@prisma/client';

const { locale, t } = useI18n();

const props = defineProps<{
  congregationId?: string | null;
}>();

const { data: congregations } = useFetch<Congregation[]>('/api/congregations');
const loading = ref(false);

const initialBalance = ref(0);
const initialBalanceDate = ref(new Date().toISOString().slice(0, 10));
const selectedCongregationId = ref<string | null>(props.congregationId ?? null);

const { formatInputDisplay } = useCurrencyInput();
const balanceDisplay = ref(initialBalance.value ? formatInputDisplay(initialBalance.value) : '');

const { data: existingConfig, refresh } = useFetch('/api/treasury-config', {
  query: computed(() => ({
    congregationId: selectedCongregationId.value || undefined,
  })),
  watch: [selectedCongregationId],
});

watch(existingConfig, (config) => {
  if (config) {
    initialBalance.value = (config as { initialBalance: number }).initialBalance ?? 0;
    const dateValue = (config as { initialBalanceDate: string }).initialBalanceDate;
    if (dateValue) {
      initialBalanceDate.value = new Date(dateValue).toISOString().slice(0, 10);
    }
    balanceDisplay.value = initialBalance.value ? formatInputDisplay(initialBalance.value) : '';
  }
});

async function onBalanceInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const digits = target.value.replace(/\D/g, '');
  const cents = Number.parseInt(digits || '0', 10);
  const value = cents / 100;
  initialBalance.value = value;

  if (cents === 0) {
    balanceDisplay.value = '';
    target.value = '';
    return;
  }

  const formatted = formatInputDisplay(value);
  balanceDisplay.value = formatted;
  await nextTick();
  target.value = formatted;
  target.setSelectionRange(formatted.length, formatted.length);
}

function onBalanceBlur() {
  if (initialBalance.value > 0) {
    balanceDisplay.value = formatInputDisplay(initialBalance.value);
  } else {
    balanceDisplay.value = '';
  }
}

function parseDateStringToDateValue(value?: string | null): DateValue | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new CalendarDate(year, month, day);
}

function toDateString(value: DateValue | undefined): string {
  if (!value) return '';
  return value.toString();
}

function formatDateDisplay(value: DateValue | undefined): string {
  if (!value) return '';
  return value.toDate(getLocalTimeZone()).toLocaleDateString(locale.value);
}

function onDateChange(dateValue: unknown) {
  const d = dateValue as DateValue | undefined;
  if (d) {
    initialBalanceDate.value = toDateString(d);
  }
}

const NO_CONGREGATION_VALUE = '__none__';

async function handleSave() {
  loading.value = true;
  try {
    await $fetch('/api/treasury-config', {
      method: 'PUT',
      body: {
        initialBalance: initialBalance.value,
        initialBalanceDate: initialBalanceDate.value,
        congregationId: selectedCongregationId.value || null,
      },
    });
    toast.success(t('pages.treasury.configSaveSuccess'));
    await refresh();
  } catch {
    toast.error(t('pages.treasury.configSaveError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t('form.treasuryConfig.title') }}</CardTitle>
      <CardDescription>{{ $t('form.treasuryConfig.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <Label>{{ $t('form.treasuryConfig.congregation') }}</Label>
        <Select
          :model-value="selectedCongregationId || NO_CONGREGATION_VALUE"
          @update:model-value="
            (value: AcceptableValue) =>
              (selectedCongregationId = value === NO_CONGREGATION_VALUE ? null : (value as string))
          "
        >
          <SelectTrigger>
            <SelectValue :placeholder="$t('form.treasuryConfig.congregationPlaceholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="NO_CONGREGATION_VALUE">
              {{ $t('form.treasuryConfig.global') }}
            </SelectItem>
            <SelectItem
              v-for="congregation in congregations || []"
              :key="congregation.id"
              :value="congregation.id"
            >
              {{ congregation.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-2">
        <Label>{{ $t('form.treasuryConfig.initialBalance') }}</Label>
        <Input
          :model-value="balanceDisplay"
          inputmode="decimal"
          :placeholder="$t('form.treasuryConfig.initialBalancePlaceholder')"
          @input="onBalanceInput"
          @blur="onBalanceBlur"
        />
      </div>

      <div class="space-y-2">
        <Label>{{ $t('form.treasuryConfig.initialBalanceDate') }}</Label>
        <Popover>
          <PopoverTrigger as-child>
            <Button
              type="button"
              variant="outline"
              :class="[
                'w-full justify-start text-left font-normal',
                !initialBalanceDate && 'text-muted-foreground',
              ]"
            >
              <CalendarIcon class="mr-2 size-4" />
              {{
                initialBalanceDate
                  ? formatDateDisplay(parseDateStringToDateValue(initialBalanceDate))
                  : $t('common.pickADate')
              }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0">
            <Calendar
              :model-value="parseDateStringToDateValue(initialBalanceDate)"
              layout="month-and-year"
              @update:model-value="onDateChange"
            />
          </PopoverContent>
        </Popover>
      </div>
    </CardContent>
    <CardFooter>
      <Button :disabled="loading" @click="handleSave">
        <template v-if="loading">{{ $t('common.loading') }}</template>
        <template v-else>{{ $t('common.save') }}</template>
      </Button>
    </CardFooter>
  </Card>
</template>
