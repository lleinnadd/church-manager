<script setup lang="ts">
import { DepartmentScope } from '@prisma/client';
import { CalendarIcon, Trash2, TriangleAlertIcon } from 'lucide-vue-next';
import type { DateValue } from '@internationalized/date';
import type { MemberFormData, MemberFormPayload } from '@/types/forms';

const props = defineProps<{
  initialData?: MemberFormData;
  loading?: boolean;
}>();

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
  formatDateDisplay,
  addMembership,
  removeMembership,
  functionsForMembership,
  departmentLabel,
  membershipHasScopeDivision,
  toPayload,
} = model;

const errorList = computed(() => {
  const messages = Object.values(errors.value).filter(Boolean) as string[];
  return [...new Set(messages)];
});

const onSubmit = handleSubmit((formValues) => {
  emit('submit', toPayload(formValues));
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
      <CardContent class="grid gap-4 md:grid-cols-2">
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
              <Select :model-value="field.value" @update:model-value="field.onChange">
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
                  <Select :model-value="field.value" @update:model-value="field.onChange">
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
      <Button type="submit" :disabled="loading">
        <span v-if="loading">{{ $t('common.saving') }}</span>
        <span v-else>{{ $t('common.save') }}</span>
      </Button>
    </div>
  </form>
</template>
