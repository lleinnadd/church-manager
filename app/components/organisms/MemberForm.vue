<script setup lang="ts">
import { DepartmentScope } from '@prisma/client';
import { CalendarIcon, Trash2, TriangleAlertIcon } from '@lucide/vue';
import type { DateValue } from '@internationalized/date';
import type { MemberFormData, MemberFormPayload } from '@/types/forms';

const props = defineProps<{
  initialData?: MemberFormData;
  loading?: boolean;
}>();

const { locale } = useI18n();

const emit = defineEmits<{
  submit: [data: MemberFormPayload];
}>();

const model = useMemberFormModel(toRef(props, 'initialData'));

const {
  isClerkManaged,
  dateOfBirthValue,
  memberSinceValue,
  convertionDateValue,
  maskedSsn,
  maskedNationalId,
  maskedPhonePrimary,
  maskedPhoneSecondary,
  onSsnInput,
  onNationalIdInput,
  onPhonePrimaryInput,
  onPhoneSecondaryInput,
  congregations,
  congregationsStatus,
  departments,
  departmentsStatus,
  statusOptions,
  maritalStatusOptions,
  showDepartments,
  memberships,
  values,
  errors,
  submitCount,
  handleSubmit,
  setFieldValue,
  formatDateDisplay,
  addMembership,
  removeMembership,
  functionsForMembership,
  departmentLabel,
  membershipHasScopeDivision,
  toPayload,
} = model;

interface MemberPhotoUploadResponse {
  photoUrl: string;
  photoBlobPath: string;
}

const fileInputRef = ref<HTMLInputElement | null>(null);
const sourceImageObjectUrl = ref<string | null>(null);
const previewImageObjectUrl = ref<string | null>(null);
const cropDialogOpen = ref(false);
const pendingPhotoFile = ref<File | null>(null);
const isUploadingPhoto = ref(false);
const photoError = ref('');

const photoPreviewUrl = computed(() => {
  return previewImageObjectUrl.value || values.photoUrl || null;
});

function revokeSourceImageObjectUrl() {
  if (sourceImageObjectUrl.value && sourceImageObjectUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(sourceImageObjectUrl.value);
  }
  sourceImageObjectUrl.value = null;
}

function setPreviewImageObjectUrl(nextUrl: string | null) {
  if (previewImageObjectUrl.value && previewImageObjectUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewImageObjectUrl.value);
  }
  previewImageObjectUrl.value = nextUrl;
}

function openPhotoPicker() {
  fileInputRef.value?.click();
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('invalid-image'));
    };

    image.src = objectUrl;
  });
}

async function onPhotoFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const [file] = input.files ?? [];
  input.value = '';

  if (!file) {
    return;
  }

  photoError.value = '';

  if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) {
    photoError.value = $t('form.member.photoInvalidType');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    photoError.value = $t('form.member.photoMaxSize');
    return;
  }

  try {
    const image = await loadImage(file);
    if (image.width < 300 || image.height < 400) {
      photoError.value = $t('form.member.photoMinResolution');
      return;
    }

    revokeSourceImageObjectUrl();
    sourceImageObjectUrl.value = URL.createObjectURL(file);
    pendingPhotoFile.value = file;
    cropDialogOpen.value = true;
  } catch {
    photoError.value = $t('form.member.photoLoadError');
  }
}

async function applyPhotoCrop() {
  if (!sourceImageObjectUrl.value || !pendingPhotoFile.value) {
    return;
  }

  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('invalid-image'));
    image.src = sourceImageObjectUrl.value as string;
  });

  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const targetRatio = 3 / 4;
  const sourceRatio = sourceWidth / sourceHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = Math.round(sourceHeight * targetRatio);
  } else {
    cropHeight = Math.round(sourceWidth / targetRatio);
  }

  const cropX = Math.max(0, Math.floor((sourceWidth - cropWidth) / 2));
  const cropY = Math.max(0, Math.floor((sourceHeight - cropHeight) / 2));

  const outputWidth = Math.max(300, cropWidth);
  const outputHeight = Math.max(400, cropHeight);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    photoError.value = $t('form.member.photoCropError');
    return;
  }

  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.9);
  });

  if (!blob) {
    photoError.value = $t('form.member.photoCropError');
    return;
  }

  if (blob.size > 2 * 1024 * 1024) {
    photoError.value = $t('form.member.photoMaxSize');
    return;
  }

  pendingPhotoFile.value = new File([blob], `${Date.now()}-3x4.webp`, { type: 'image/webp' });
  setPreviewImageObjectUrl(URL.createObjectURL(pendingPhotoFile.value));
  setFieldValue('photoUrl', null, false);
  setFieldValue('photoBlobPath', null, false);
  cropDialogOpen.value = false;
  revokeSourceImageObjectUrl();
}

function removePhoto() {
  pendingPhotoFile.value = null;
  setPreviewImageObjectUrl(null);
  setFieldValue('photoUrl', null, false);
  setFieldValue('photoBlobPath', null, false);
  photoError.value = '';
}

function cancelPhotoCrop() {
  cropDialogOpen.value = false;
  revokeSourceImageObjectUrl();
  pendingPhotoFile.value = null;
}

watch(
  () => props.initialData?.photoUrl,
  (nextPhotoUrl) => {
    if (!pendingPhotoFile.value && !previewImageObjectUrl.value) {
      setFieldValue('photoUrl', nextPhotoUrl ?? null, false);
      setFieldValue('photoBlobPath', props.initialData?.photoBlobPath ?? null, false);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  revokeSourceImageObjectUrl();
  setPreviewImageObjectUrl(null);
});

const errorList = computed(() => {
  const messages = Object.values(errors.value).filter(Boolean) as string[];
  return [...new Set(messages)];
});

const onSubmit = handleSubmit(async (formValues) => {
  photoError.value = '';
  let payload = toPayload(formValues);

  if (pendingPhotoFile.value) {
    isUploadingPhoto.value = true;
    try {
      const body = new FormData();
      body.append('file', pendingPhotoFile.value);

      const uploaded = await $fetch<MemberPhotoUploadResponse>('/api/members/photo', {
        method: 'POST',
        body,
      });

      payload = {
        ...payload,
        photoUrl: uploaded.photoUrl,
        photoBlobPath: uploaded.photoBlobPath,
      };

      setFieldValue('photoUrl', uploaded.photoUrl, false);
      setFieldValue('photoBlobPath', uploaded.photoBlobPath, false);
      pendingPhotoFile.value = null;
    } catch {
      photoError.value = $t('form.member.photoUploadError');
      return;
    } finally {
      isUploadingPhoto.value = false;
    }
  }

  emit('submit', payload);
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

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.generalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.member.generalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-6 md:flex-row">
        <div class="shrink-0 space-y-2">
          <p class="text-sm font-medium">{{ $t('form.member.photoTitle') }}</p>

          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            accept="image/png,image/webp,image/jpeg"
            @change="onPhotoFileChange"
          />

          <div class="group relative w-36 overflow-hidden rounded-md border bg-muted">
            <div class="aspect-3/4">
              <img
                v-if="photoPreviewUrl"
                :src="photoPreviewUrl"
                :alt="$t('form.member.photoAlt')"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground"
              >
                {{ $t('form.member.photoEmpty') }}
              </div>
            </div>

            <div
              class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 w-28 text-xs"
                @click="openPhotoPicker"
              >
                {{
                  photoPreviewUrl ? $t('form.member.photoReplace') : $t('form.member.photoSelect')
                }}
              </Button>
              <Button
                v-if="photoPreviewUrl"
                type="button"
                variant="destructive"
                size="sm"
                class="h-8 w-28 text-xs"
                @click="removePhoto"
              >
                <Trash2 class="mr-1 size-3.5" />
                {{ $t('common.remove') }}
              </Button>
            </div>
          </div>

          <p class="max-w-36 text-[11px] leading-tight text-muted-foreground">
            {{ $t('form.member.photoRules') }}
          </p>
          <p v-if="photoError" class="max-w-36 text-sm text-destructive">{{ photoError }}</p>
        </div>

        <div class="grid flex-1 gap-4 md:grid-cols-2">
          <div v-if="initialData?.memberNumber" class="space-y-2">
            <Label>{{ $t('form.member.memberNumber') }}</Label>
            <Input :model-value="String(initialData.memberNumber)" disabled />
          </div>

          <FormField v-slot="{ componentField }" name="name">
            <FormItem>
              <FormLabel>{{ $t('form.member.name') }}</FormLabel>
              <FormControl>
                <Input
                  v-bind="componentField"
                  :placeholder="$t('form.member.namePlaceholder')"
                  :disabled="isClerkManaged"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ field, meta }" name="congregationId">
            <FormItem>
              <FormLabel>{{ $t('form.member.congregation') }}</FormLabel>
              <FormControl>
                <Select :model-value="field.value" @update:model-value="field.onChange">
                  <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                    <SelectValue :placeholder="$t('form.member.congregationPlaceholder')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="c in congregations || []"
                      :key="c.id"
                      :value="c.id"
                      :disabled="congregationsStatus === 'pending'"
                    >
                      {{ c.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ field, meta }" name="status">
            <FormItem>
              <FormLabel>{{ $t('form.member.status') }}</FormLabel>
              <FormControl>
                <Select
                  :key="locale"
                  :model-value="field.value"
                  :disabled="isClerkManaged"
                  @update:model-value="field.onChange"
                >
                  <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                    <SelectValue :placeholder="$t('form.member.statusPlaceholder')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in statusOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.personalInfo') }}</CardTitle>
        <CardDescription>{{ $t('form.member.personalInfoDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ field, meta }" name="dateOfBirth">
          <FormItem>
            <FormLabel>{{ $t('form.member.dateOfBirth') }}</FormLabel>
            <Popover>
              <FormControl>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="[
                      'w-full justify-start text-left font-normal',
                      !dateOfBirthValue && 'text-muted-foreground',
                    ]"
                    :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid"
                    @blur="field.onBlur"
                  >
                    <CalendarIcon class="mr-2 size-4" />
                    {{
                      dateOfBirthValue
                        ? formatDateDisplay(dateOfBirthValue as DateValue)
                        : $t('common.pickADate')
                    }}
                  </Button>
                </PopoverTrigger>
              </FormControl>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="dateOfBirthValue as DateValue"
                  layout="month-and-year"
                  @update:model-value="(v) => (dateOfBirthValue = v as DateValue)"
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ field, meta }" name="maritalStatus">
          <FormItem>
            <FormLabel>{{ $t('form.member.maritalStatus') }}</FormLabel>
            <FormControl>
              <Select :key="locale" :model-value="field.value" @update:model-value="field.onChange">
                <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                  <SelectValue :placeholder="$t('form.member.maritalStatusPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in maritalStatusOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="motherName">
          <FormItem>
            <FormLabel>{{ $t('form.member.motherName') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.member.motherNamePlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="fatherName">
          <FormItem>
            <FormLabel>{{ $t('form.member.fatherName') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.member.fatherNamePlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="naturality">
          <FormItem>
            <FormLabel>{{ $t('form.member.naturality') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.member.naturalityPlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="nationality">
          <FormItem>
            <FormLabel>{{ $t('form.member.nationality') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.member.nationalityPlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.documents') }}</CardTitle>
        <CardDescription>{{ $t('form.member.documentsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ field }" name="ssn">
          <FormItem>
            <FormLabel>{{ $t('form.member.ssn') }}</FormLabel>
            <FormControl>
              <Input
                :model-value="maskedSsn"
                :placeholder="$t('form.member.ssnPlaceholder')"
                inputmode="numeric"
                maxlength="14"
                @input="onSsnInput"
                @blur="field.onBlur"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ field }" name="nationalId">
          <FormItem>
            <FormLabel>{{ $t('form.member.nationalId') }}</FormLabel>
            <FormControl>
              <Input
                :model-value="maskedNationalId"
                :placeholder="$t('form.member.nationalIdPlaceholder')"
                inputmode="numeric"
                maxlength="12"
                @input="onNationalIdInput"
                @blur="field.onBlur"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.address') }}</CardTitle>
        <CardDescription>{{ $t('form.member.addressDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ componentField }" name="addressLinePrimary">
          <FormItem>
            <FormLabel>{{ $t('form.member.addressLinePrimary') }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('form.member.addressLinePrimaryPlaceholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="district">
          <FormItem>
            <FormLabel>{{ $t('form.member.district') }}</FormLabel>
            <FormControl>
              <Input v-bind="componentField" :placeholder="$t('form.member.districtPlaceholder')" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.contact') }}</CardTitle>
        <CardDescription>{{ $t('form.member.contactDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ field }" name="phonePrimary">
          <FormItem>
            <FormLabel>{{ $t('form.member.phonePrimary') }}</FormLabel>
            <FormControl>
              <Input
                :model-value="maskedPhonePrimary"
                type="tel"
                :placeholder="$t('form.member.phonePrimaryPlaceholder')"
                inputmode="numeric"
                maxlength="15"
                @input="onPhonePrimaryInput"
                @blur="field.onBlur"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ field }" name="phoneSecondary">
          <FormItem>
            <FormLabel>{{ $t('form.member.phoneSecondary') }}</FormLabel>
            <FormControl>
              <Input
                :model-value="maskedPhoneSecondary"
                type="tel"
                :placeholder="$t('form.member.phoneSecondaryPlaceholder')"
                inputmode="numeric"
                maxlength="15"
                @input="onPhoneSecondaryInput"
                @blur="field.onBlur"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.membershipDates') }}</CardTitle>
        <CardDescription>{{ $t('form.member.membershipDatesDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ field, meta }" name="memberSince">
          <FormItem>
            <FormLabel>{{ $t('form.member.memberSince') }}</FormLabel>
            <Popover>
              <FormControl>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="[
                      'w-full justify-start text-left font-normal',
                      !memberSinceValue && 'text-muted-foreground',
                    ]"
                    :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid"
                    @blur="field.onBlur"
                  >
                    <CalendarIcon class="mr-2 size-4" />
                    {{
                      memberSinceValue
                        ? formatDateDisplay(memberSinceValue as DateValue)
                        : $t('common.pickADate')
                    }}
                  </Button>
                </PopoverTrigger>
              </FormControl>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="memberSinceValue as DateValue"
                  layout="month-and-year"
                  @update:model-value="(v) => (memberSinceValue = v as DateValue)"
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ field, meta }" name="convertionDate">
          <FormItem>
            <FormLabel>{{ $t('form.member.convertionDate') }}</FormLabel>
            <Popover>
              <FormControl>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="[
                      'w-full justify-start text-left font-normal',
                      !convertionDateValue && 'text-muted-foreground',
                    ]"
                    :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid"
                    @blur="field.onBlur"
                  >
                    <CalendarIcon class="mr-2 size-4" />
                    {{
                      convertionDateValue
                        ? formatDateDisplay(convertionDateValue as DateValue)
                        : $t('common.pickADate')
                    }}
                  </Button>
                </PopoverTrigger>
              </FormControl>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="convertionDateValue as DateValue"
                  layout="month-and-year"
                  @update:model-value="(v) => (convertionDateValue = v as DateValue)"
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t('form.member.observations') }}</CardTitle>
        <CardDescription>{{ $t('form.member.observationsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormField v-slot="{ componentField }" name="observations">
          <FormItem>
            <FormLabel>{{ $t('form.member.observations') }}</FormLabel>
            <FormControl>
              <Textarea
                v-bind="componentField"
                :placeholder="$t('form.member.observationsPlaceholder')"
                rows="4"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>
    </Card>

    <Card v-if="showDepartments">
      <CardHeader>
        <CardTitle>{{ $t('form.member.departments') }}</CardTitle>
        <CardDescription>{{ $t('form.member.departmentsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="departmentsStatus === 'pending'" class="text-sm text-muted-foreground">
          {{ $t('common.loading') }}
        </div>
        <div v-else-if="!departments?.length" class="text-sm text-muted-foreground">
          {{ $t('form.member.noDepartments') }}
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="(membership, index) in memberships"
            :key="index"
            class="grid gap-3 items-end md:grid-cols-[repeat(3,minmax(0,1fr))_36px]"
          >
            <FormField v-slot="{ field, meta }" :name="`departments.${index}.departmentId`">
              <FormItem>
                <FormLabel>{{ $t('form.member.department') }}</FormLabel>
                <FormControl>
                  <Select
                    :key="`${membership.departmentId}-${membership.scope ?? 'none'}-${membership.congregationId ?? values.congregationId ?? 'none'}`"
                    :model-value="field.value"
                    @update:model-value="field.onChange"
                  >
                    <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                      <SelectValue :placeholder="$t('form.member.departmentPlaceholder')" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="d in departments" :key="d.id" :value="d.id">
                        {{ departmentLabel(d, membership) }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
            <FormField v-slot="{ field, meta }" :name="`departments.${index}.functionId`">
              <FormItem>
                <FormLabel>{{ $t('form.member.departmentFunction') }}</FormLabel>
                <FormControl>
                  <Select
                    class="w-full"
                    :model-value="field.value"
                    :disabled="!functionsForMembership(membership).length"
                    @update:model-value="field.onChange"
                  >
                    <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                      <SelectValue :placeholder="$t('form.member.departmentFunctionPlaceholder')" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="fn in functionsForMembership(membership)"
                        :key="fn.id"
                        :value="fn.id"
                      >
                        {{ fn.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
                <p
                  v-if="!functionsForMembership(membership).length"
                  class="text-xs text-muted-foreground"
                >
                  {{ $t('form.member.noDepartmentFunctions') }}
                </p>
              </FormItem>
            </FormField>
            <FormField
              v-if="membershipHasScopeDivision(membership)"
              v-slot="{ field, meta }"
              :name="`departments.${index}.scope`"
            >
              <FormItem>
                <FormLabel>{{ $t('form.member.scope') }}</FormLabel>
                <FormControl>
                  <Select
                    :key="locale"
                    :model-value="field.value"
                    @update:model-value="field.onChange"
                  >
                    <SelectTrigger :aria-invalid="(meta.touched || submitCount > 0) && !meta.valid">
                      <SelectValue :placeholder="$t('form.member.scopePlaceholder')" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="DepartmentScope.LOCAL">
                        {{ $t('departments.scope.local') }}
                      </SelectItem>
                      <SelectItem :value="DepartmentScope.GENERAL">
                        {{ $t('departments.scope.general') }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="col-start-1 justify-self-end md:col-start-4"
              @click="removeMembership(index)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
          <Button type="button" variant="outline" @click="addMembership">
            {{ $t('form.member.addDepartment') }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card v-else>
      <CardHeader>
        <CardTitle>{{ $t('form.member.departments') }}</CardTitle>
        <CardDescription>{{ $t('form.member.departmentsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        {{ $t('form.member.departmentsInactiveHint') }}
      </CardContent>
    </Card>

    <div class="flex items-center gap-3">
      <Button type="button" variant="outline" as-child>
        <NuxtLink to="/members">
          {{ $t('common.back') }}
        </NuxtLink>
      </Button>
      <Button type="submit" :disabled="loading || isUploadingPhoto">
        <span v-if="loading || isUploadingPhoto">{{ $t('common.saving') }}</span>
        <span v-else>{{ $t('common.save') }}</span>
      </Button>
    </div>

    <Dialog :open="cropDialogOpen" @update:open="(value) => (cropDialogOpen = value)">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ $t('form.member.photoCropTitle') }}</DialogTitle>
          <DialogDescription>{{ $t('form.member.photoCropDescription') }}</DialogDescription>
        </DialogHeader>

        <div class="space-y-3">
          <div class="aspect-3/4 overflow-hidden rounded-md border bg-muted">
            <img
              v-if="sourceImageObjectUrl"
              :src="sourceImageObjectUrl"
              :alt="$t('form.member.photoCropPreviewAlt')"
              class="h-full w-full object-cover"
            />
          </div>
          <p class="text-xs text-muted-foreground">{{ $t('form.member.photoCropHint') }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="cancelPhotoCrop">
            {{ $t('common.cancel') }}
          </Button>
          <Button type="button" @click="applyPhotoCrop">
            {{ $t('form.member.photoApplyCrop') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </form>
</template>
