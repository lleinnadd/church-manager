<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui';
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  TriangleAlertIcon,
  Upload,
  X,
  FileText,
  Image,
} from '@lucide/vue';
import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
import type { TransactionFormData, TransactionFormPayload } from '@/types/forms';

const props = defineProps<{
  initialData?: TransactionFormData;
  loading?: boolean;
}>();

const { locale, t } = useI18n();

const emit = defineEmits<{
  submit: [data: TransactionFormPayload, files: File[]];
}>();

const model = useTransactionFormModel(toRef(props, 'initialData'));

const {
  values,
  errors,
  submitCount,
  congregations,
  congregationsStatus,
  isExpense,
  handleSubmit,
  setFieldValue,
  toPayload,
} = model;

const { formatInputDisplay, parseInput } = useCurrencyInput();

const {
  categories,
  searchQuery: categorySearch,
  isLoading: _categoriesLoading,
  isCreating: categoryCreating,
  setSearch: setCategorySearch,
  createCategory,
} = useTransactionCategories();

const errorList = computed(() => {
  const messages = Object.values(errors.value).filter(Boolean);
  return [...new Set(messages)];
});

const selectedHour = computed(() => {
  if (!values.date || values.date.length < 16) return 12;
  return Number.parseInt(values.date.slice(11, 13), 10);
});

const selectedMinute = computed(() => {
  if (!values.date || values.date.length < 16) return 0;
  return Number.parseInt(values.date.slice(14, 16), 10);
});

const selectedDatePart = computed(() => {
  if (!values.date) return '';
  return values.date.slice(0, 10);
});

function updateTime(hour: number, minute: number) {
  const datePart = selectedDatePart.value || new Date().toISOString().slice(0, 10);
  const h = String(Math.max(0, Math.min(23, hour))).padStart(2, '0');
  const m = String(Math.max(0, Math.min(59, minute))).padStart(2, '0');
  setFieldValue('date', `${datePart}T${h}:${m}`);
}

function incrementHour() {
  updateTime((selectedHour.value + 1) % 24, selectedMinute.value);
}

function decrementHour() {
  updateTime((selectedHour.value + 23) % 24, selectedMinute.value);
}

function incrementMinute() {
  updateTime(selectedHour.value, (selectedMinute.value + 1) % 60);
}

function decrementMinute() {
  updateTime(selectedHour.value, (selectedMinute.value + 59) % 60);
}

function parseDateStringToDateValue(value?: string | null): DateValue | undefined {
  if (!value) return undefined;
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
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

function onDateChange(dateValue: DateValue | undefined) {
  if (!dateValue) return;
  const dateStr = toDateString(dateValue);
  const h = String(selectedHour.value).padStart(2, '0');
  const m = String(selectedMinute.value).padStart(2, '0');
  setFieldValue('date', `${dateStr}T${h}:${m}`);
}

const pendingFiles = ref<File[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return t('form.transaction.fileTypeError');
  }
  if (file.size > MAX_FILE_SIZE) {
    return t('form.transaction.fileSizeError');
  }
  return null;
}

function addFiles(files: FileList | File[]) {
  const fileArray = Array.from(files);
  fileArray.forEach((file) => {
    const error = validateFile(file);
    if (!error) {
      pendingFiles.value.push(file);
    }
  });
}

function removeFile(index: number) {
  pendingFiles.value.splice(index, 1);
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    addFiles(input.files);
    input.value = '';
  }
}

function onDrop(event: DragEvent) {
  isDragging.value = false;
  if (event.dataTransfer?.files) {
    addFiles(event.dataTransfer.files);
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function onDragLeave() {
  isDragging.value = false;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith('image/');
}

const amountDisplay = ref(formatInputDisplay(props.initialData?.amount ?? 0));

function onAmountInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const parsed = parseInput(target.value);
  setFieldValue('amount', parsed);
  amountDisplay.value = target.value;
}

function onAmountBlur() {
  amountDisplay.value = formatInputDisplay(values.amount);
}

const categoryOpen = ref(false);
const selectedCategoryName = computed(() => {
  if (!values.categoryId) return '';
  const cat = categories.value?.find((c) => c.id === values.categoryId);
  return cat?.name ?? '';
});

async function handleCreateCategory() {
  if (!categorySearch.value.trim()) return;
  const created = await createCategory(categorySearch.value);
  if (created) {
    setFieldValue('categoryId', created.id);
    categoryOpen.value = false;
  }
}

const hasAttachments = computed(() => {
  const existingCount = props.initialData?.attachments?.length ?? 0;
  return existingCount + pendingFiles.value.length > 0;
});

const onSubmit = handleSubmit((formValues) => {
  if (formValues.type === 'EXPENSE' && !hasAttachments.value) {
    return;
  }
  emit('submit', toPayload(formValues), pendingFiles.value);
});
</script>

<template>
  <form class="space-y-8" @submit.prevent="onSubmit">
    <Alert v-if="submitCount > 0 && errorList.length" variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>{{ $t('validation.title') }}</AlertTitle>
      <AlertDescription>
        <p>{{ $t('validation.description') }}</p>
        <ul class="ml-4 list-disc space-y-1">
          <li v-for="(message, index) in errorList" :key="index">
            {{ message }}
          </li>
        </ul>
      </AlertDescription>
    </Alert>

    <Alert v-if="submitCount > 0 && isExpense && !hasAttachments" variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>{{ $t('form.transaction.attachmentRequired') }}</AlertTitle>
      <AlertDescription>{{
        $t('form.transaction.attachmentRequiredDescription')
      }}</AlertDescription>
    </Alert>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.transaction.generalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.transaction.generalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem class="md:col-span-2">
            <FormLabel>{{ $t('form.transaction.name') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.transaction.namePlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ field }" name="type">
          <FormItem>
            <FormLabel>{{ $t('form.transaction.type') }}</FormLabel>
            <FormControl>
              <Select :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.transaction.typePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">
                    {{ $t('form.transaction.income') }}
                  </SelectItem>
                  <SelectItem value="EXPENSE">
                    {{ $t('form.transaction.expense') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField name="amount">
          <FormItem>
            <FormLabel>{{ $t('form.transaction.amount') }}</FormLabel>
            <FormControl>
              <Input
                :model-value="amountDisplay"
                inputmode="decimal"
                :placeholder="$t('form.transaction.amountPlaceholder')"
                @input="onAmountInput"
                @blur="onAmountBlur"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ field, meta }" name="date">
          <FormItem>
            <FormLabel>{{ $t('form.transaction.date') }}</FormLabel>
            <Popover>
              <FormControl>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="[
                      'w-full justify-start text-left font-normal',
                      !selectedDatePart && 'text-muted-foreground',
                    ]"
                    :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid"
                    @blur="field.onBlur"
                  >
                    <CalendarIcon class="mr-2 size-4" />
                    <template v-if="selectedDatePart">
                      {{ formatDateDisplay(parseDateStringToDateValue(field.value)) }}
                      <span class="ml-auto tabular-nums text-muted-foreground">
                        {{ String(selectedHour).padStart(2, '0') }}:{{
                          String(selectedMinute).padStart(2, '0')
                        }}
                      </span>
                    </template>
                    <template v-else>
                      {{ $t('common.pickADate') }}
                    </template>
                  </Button>
                </PopoverTrigger>
              </FormControl>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="parseDateStringToDateValue(field.value)"
                  layout="month-and-year"
                  @update:model-value="(v) => onDateChange(v as DateValue)"
                />
                <div class="flex items-center justify-center gap-1 border-t px-4 py-3">
                  <div class="flex flex-col items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-7"
                      @click="incrementHour"
                    >
                      <ChevronUp class="size-4" />
                    </Button>
                    <span class="w-8 text-center text-lg font-semibold tabular-nums">
                      {{ String(selectedHour).padStart(2, '0') }}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-7"
                      @click="decrementHour"
                    >
                      <ChevronDown class="size-4" />
                    </Button>
                  </div>
                  <span class="text-lg font-semibold">:</span>
                  <div class="flex flex-col items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-7"
                      @click="incrementMinute"
                    >
                      <ChevronUp class="size-4" />
                    </Button>
                    <span class="w-8 text-center text-lg font-semibold tabular-nums">
                      {{ String(selectedMinute).padStart(2, '0') }}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-7"
                      @click="decrementMinute"
                    >
                      <ChevronDown class="size-4" />
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ field }" name="congregationId">
          <FormItem>
            <FormLabel>{{ $t('form.transaction.congregation') }}</FormLabel>
            <FormControl>
              <Select
                :model-value="field.value ?? ''"
                @update:model-value="(value: AcceptableValue) => field.onChange(value)"
              >
                <SelectTrigger>
                  <SelectValue :placeholder="$t('form.transaction.congregationPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="congregation in congregations || []"
                    :key="congregation.id"
                    :value="congregation.id"
                  >
                    {{ congregation.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
            <p v-if="congregationsStatus === 'pending'" class="text-xs text-muted-foreground">
              {{ $t('common.loading') }}
            </p>
          </FormItem>
        </FormField>

        <FormField name="categoryId">
          <FormItem>
            <FormLabel>{{ $t('form.transaction.category') }}</FormLabel>
            <Popover v-model:open="categoryOpen">
              <PopoverTrigger as-child>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    class="w-full justify-between font-normal"
                    :class="{ 'text-muted-foreground': !values.categoryId }"
                  >
                    {{ selectedCategoryName || $t('form.transaction.categoryPlaceholder') }}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent class="w-75 p-0">
                <Command>
                  <CommandInput
                    :placeholder="$t('form.transaction.categorySearch')"
                    :model-value="categorySearch"
                    @update:model-value="setCategorySearch"
                  />
                  <CommandList>
                    <CommandEmpty>
                      <div class="py-2 text-center text-sm">
                        <p class="text-muted-foreground mb-2">
                          {{ $t('form.transaction.categoryNotFound') }}
                        </p>
                        <Button
                          v-if="categorySearch.trim()"
                          size="sm"
                          variant="outline"
                          :disabled="categoryCreating"
                          @click="handleCreateCategory"
                        >
                          {{
                            $t('form.transaction.categoryCreate', { name: categorySearch.trim() })
                          }}
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        :value="'__clear__'"
                        @select="
                          () => {
                            setFieldValue('categoryId', null);
                            categoryOpen = false;
                          }
                        "
                      >
                        <span class="text-muted-foreground">{{
                          $t('form.transaction.noCategory')
                        }}</span>
                      </CommandItem>
                      <CommandItem
                        v-for="cat in categories || []"
                        :key="cat.id"
                        :value="cat.name"
                        @select="
                          () => {
                            setFieldValue('categoryId', cat.id);
                            categoryOpen = false;
                          }
                        "
                      >
                        {{ cat.name }}
                      </CommandItem>
                    </CommandGroup>
                    <CommandGroup v-if="categorySearch.trim() && (categories?.length ?? 0) > 0">
                      <CommandItem :value="'__create__'" @select="handleCreateCategory">
                        <span class="text-primary">
                          {{
                            $t('form.transaction.categoryCreate', { name: categorySearch.trim() })
                          }}
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="notes">
          <FormItem class="md:col-span-2">
            <FormLabel>{{ $t('form.transaction.notes') }}</FormLabel>
            <FormControl>
              <Textarea
                v-bind="componentField"
                rows="3"
                :placeholder="$t('form.transaction.notesPlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>
          {{ $t('form.transaction.attachments') }}
          <Badge v-if="isExpense" variant="destructive" class="ml-2">
            {{ $t('form.transaction.required') }}
          </Badge>
        </CardTitle>
        <CardDescription>{{ $t('form.transaction.attachmentsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="initialData?.attachments?.length" class="space-y-2">
          <p class="text-sm font-medium">{{ $t('form.transaction.existingAttachments') }}</p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="att in initialData.attachments"
              :key="att.id"
              class="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <component
                :is="isImageType(att.fileType) ? Image : FileText"
                class="size-4 text-muted-foreground"
              />
              <a :href="att.blobUrl" target="_blank" rel="noopener" class="hover:underline">
                {{ att.fileName }}
              </a>
              <span class="text-muted-foreground text-xs">
                {{ formatFileSize(att.fileSize) }}
              </span>
            </div>
          </div>
        </div>

        <div
          class="relative rounded-lg border-2 border-dashed p-8 text-center transition-colors"
          :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'"
          @drop.prevent="onDrop"
          @dragover.prevent="onDragOver"
          @dragleave="onDragLeave"
        >
          <Upload class="mx-auto mb-2 size-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            {{ $t('form.transaction.dropFiles') }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ $t('form.transaction.acceptedFormats') }}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="mt-3"
            @click="fileInputRef?.click()"
          >
            {{ $t('form.transaction.selectFiles') }}
          </Button>
          <input
            ref="fileInputRef"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            class="hidden"
            @change="onFileInputChange"
          />
        </div>

        <div v-if="pendingFiles.length" class="space-y-2">
          <p class="text-sm font-medium">
            {{ $t('form.transaction.newAttachments') }} ({{ pendingFiles.length }})
          </p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(file, index) in pendingFiles"
              :key="index"
              class="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <component
                :is="isImageType(file.type) ? Image : FileText"
                class="size-4 text-muted-foreground"
              />
              <span>{{ file.name }}</span>
              <span class="text-muted-foreground text-xs">{{ formatFileSize(file.size) }}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-6"
                @click="removeFile(index)"
              >
                <X class="size-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="flex items-center gap-4">
      <Button type="submit" :disabled="loading">
        <template v-if="loading">{{ $t('common.loading') }}</template>
        <template v-else>{{ $t('common.save') }}</template>
      </Button>
      <Button type="button" variant="outline" as-child>
        <NuxtLink to="/treasury">{{ $t('common.cancel') }}</NuxtLink>
      </Button>
    </div>
  </form>
</template>
