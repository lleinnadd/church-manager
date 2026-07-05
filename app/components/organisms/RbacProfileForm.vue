<script setup lang="ts">
import { RBAC_RESOURCES, PERMISSION_ACTIONS } from '~~/shared/validation/rbac';

type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
type PermissionScopeType = 'ALL' | 'OWN_CONGREGATION';

interface PermissionEntry {
  resource: string;
  action: PermissionAction;
  scopeType: PermissionScopeType;
}

interface ProfileFormData {
  name: string;
  description: string;
  permissions: PermissionEntry[];
}

interface InitialData {
  name: string;
  description: string | null;
  permissions: PermissionEntry[];
}

const props = defineProps<{
  loading?: boolean;
  initialData?: InitialData;
}>();

const emit = defineEmits<{
  submit: [data: ProfileFormData];
}>();

const { t } = useI18n();

const name = ref(props.initialData?.name ?? '');
const description = ref(props.initialData?.description ?? '');

const ACTIONS = PERMISSION_ACTIONS;

type PermissionState = Record<string, Record<PermissionAction, boolean>>;
type ScopeState = Record<string, PermissionScopeType>;

function buildInitialState(): { perms: PermissionState; scopes: ScopeState } {
  const perms: PermissionState = {};
  const scopes: ScopeState = {};

  RBAC_RESOURCES.forEach((resource) => {
    perms[resource] = {} as Record<PermissionAction, boolean>;
    scopes[resource] = 'ALL';
    ACTIONS.forEach((action) => {
      perms[resource]![action] = false;
    });
  });

  if (props.initialData?.permissions) {
    props.initialData.permissions.forEach((p) => {
      if (perms[p.resource]) {
        perms[p.resource]![p.action] = true;
        scopes[p.resource] = p.scopeType;
      }
    });
  }

  return { perms, scopes };
}

const { perms: permState, scopes: scopeState } = buildInitialState();
const permissions = reactive(permState) as PermissionState;
const scopes = reactive(scopeState) as ScopeState;

function getPerms(resource: string): Record<PermissionAction, boolean> {
  return permissions[resource]!;
}

function getScope(resource: string): PermissionScopeType {
  return scopes[resource]!;
}

function toggleManage(resource: string) {
  const isManage = permissions[resource]!.MANAGE;
  if (isManage) {
    ACTIONS.forEach((action) => {
      if (action !== 'MANAGE') {
        permissions[resource]![action] = false;
      }
    });
  }
}

function onActionToggle(resource: string, action: PermissionAction) {
  if (action !== 'MANAGE' && permissions[resource]![action]) {
    permissions[resource]!.MANAGE = false;
  }
}

function handleSubmit() {
  const result: PermissionEntry[] = RBAC_RESOURCES.flatMap((resource) =>
    ACTIONS.filter((action) => permissions[resource]![action]).map((action) => ({
      resource,
      action,
      scopeType: scopes[resource]!,
    })),
  );

  emit('submit', {
    name: name.value,
    description: description.value,
    permissions: result,
  });
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <Label for="name">{{ $t('rbac.profileName') }}</Label>
        <Input id="name" v-model="name" required />
      </div>
      <div class="space-y-2">
        <Label for="description">{{ $t('rbac.profileDescription') }}</Label>
        <Input id="description" v-model="description" />
      </div>
    </div>

    <div class="space-y-4">
      <h3 class="text-lg font-semibold">{{ $t('rbac.permissions') }}</h3>
      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-muted/50">
              <th class="px-4 py-3 text-left font-medium">{{ t('rbac.resources.members') }}</th>
              <th v-for="action in ACTIONS" :key="action" class="px-3 py-3 text-center font-medium">
                {{ $t(`rbac.actions.${action}`) }}
              </th>
              <th class="px-4 py-3 text-left font-medium">{{ $t('rbac.scope') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="resource in RBAC_RESOURCES" :key="resource" class="border-b last:border-0">
              <td class="px-4 py-3 font-medium">
                {{ $t(`rbac.resources.${resource}`) }}
              </td>
              <td v-for="action in ACTIONS" :key="action" class="px-3 py-3 text-center">
                <Checkbox
                  :checked="getPerms(resource)[action]"
                  :disabled="action !== 'MANAGE' && getPerms(resource)['MANAGE']"
                  @update:checked="
                    (val: boolean) => {
                      getPerms(resource)[action] = val;
                      if (action === 'MANAGE') toggleManage(resource);
                      else onActionToggle(resource, action);
                    }
                  "
                />
              </td>
              <td class="px-4 py-3">
                <Select
                  :model-value="getScope(resource)"
                  @update:model-value="
                    (val: unknown) => (scopes[resource] = val as PermissionScopeType)
                  "
                >
                  <SelectTrigger class="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">
                      {{ $t('rbac.scopeTypes.ALL') }}
                    </SelectItem>
                    <SelectItem value="OWN_CONGREGATION">
                      {{ $t('rbac.scopeTypes.OWN_CONGREGATION') }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex justify-end">
      <Button type="submit" :disabled="loading || !name">
        {{ loading ? $t('common.saving') : $t('common.save') }}
      </Button>
    </div>
  </form>
</template>
