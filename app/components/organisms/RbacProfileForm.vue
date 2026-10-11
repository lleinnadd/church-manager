<script setup lang="ts">
import {
  EDITABLE_RBAC_RESOURCES,
  PERMISSION_ACTIONS,
  RESOURCE_ACTIONS,
} from '~~/shared/validation/rbac';

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

type PermissionState = Record<string, Record<PermissionAction, boolean>>;
type ScopeState = Record<string, PermissionScopeType>;

function actionsFor(resource: string): readonly PermissionAction[] {
  return RESOURCE_ACTIONS[resource as keyof typeof RESOURCE_ACTIONS] ?? [];
}

function isActionAllowed(resource: string, action: PermissionAction): boolean {
  return actionsFor(resource).includes(action);
}

function buildInitialState(): { perms: PermissionState; scopes: ScopeState } {
  const perms: PermissionState = {};
  const scopes: ScopeState = {};

  EDITABLE_RBAC_RESOURCES.forEach((resource) => {
    perms[resource] = {} as Record<PermissionAction, boolean>;
    scopes[resource] = 'OWN_CONGREGATION';
    actionsFor(resource).forEach((action) => {
      perms[resource]![action] = false;
    });
  });

  if (props.initialData?.permissions) {
    props.initialData.permissions.forEach((p) => {
      if (perms[p.resource] && isActionAllowed(p.resource, p.action)) {
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

function isResourceEnabled(resource: string): boolean {
  return actionsFor(resource).some((action) => permissions[resource]?.[action]);
}

function defaultActionFor(resource: string): PermissionAction | null {
  const allowed = actionsFor(resource);
  if (allowed.includes('READ')) return 'READ';
  return allowed[0] ?? null;
}

function toggleResource(resource: string, enabled: boolean) {
  const allowed = actionsFor(resource);
  if (!enabled) {
    allowed.forEach((action) => {
      permissions[resource]![action] = false;
    });
    return;
  }
  const isEmpty = allowed.every((action) => !permissions[resource]![action]);
  if (isEmpty) {
    const def = defaultActionFor(resource);
    if (def) permissions[resource]![def] = true;
  }
}

function onActionToggle(resource: string, action: PermissionAction, value: boolean) {
  permissions[resource]![action] = value;
  if (value && action === 'MANAGE') {
    actionsFor(resource).forEach((other) => {
      if (other !== 'MANAGE') permissions[resource]![other] = false;
    });
  } else if (value && action !== 'MANAGE') {
    permissions[resource]!.MANAGE = false;
  } else if (!value && action === 'MANAGE') {
    // Turning MANAGE off — restore a default action so the resource card
    // stays enabled instead of collapsing back to the master-off state.
    const def = defaultActionFor(resource);
    if (def && def !== 'MANAGE') permissions[resource]![def] = true;
  }
}

function isActionDisabled(resource: string, action: PermissionAction): boolean {
  if (action === 'MANAGE') return false;
  return permissions[resource]!.MANAGE === true;
}

function handleSubmit() {
  const result: PermissionEntry[] = EDITABLE_RBAC_RESOURCES.flatMap((resource) =>
    actionsFor(resource)
      .filter((action) => permissions[resource]![action])
      .map((action) => ({
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

      <div class="space-y-3">
        <Card v-for="resource in EDITABLE_RBAC_RESOURCES" :key="resource">
          <CardContent class="p-4">
            <div class="flex flex-wrap items-start gap-4">
              <label class="flex flex-1 min-w-0 items-center gap-3 cursor-pointer">
                <Checkbox
                  :model-value="isResourceEnabled(resource)"
                  @update:model-value="
                    (val: boolean | 'indeterminate') => toggleResource(resource, val === true)
                  "
                />
                <span class="text-base font-medium">
                  {{ t(`rbac.resources.${resource}`) }}
                </span>
              </label>

              <div v-if="isResourceEnabled(resource)" class="w-full sm:w-56">
                <Label class="mb-1 block text-xs text-muted-foreground">
                  {{ $t('rbac.scope') }}
                </Label>
                <Select
                  :model-value="scopes[resource]"
                  @update:model-value="
                    (val: unknown) => (scopes[resource] = val as PermissionScopeType)
                  "
                >
                  <SelectTrigger>
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
              </div>
            </div>

            <div
              v-if="isResourceEnabled(resource)"
              class="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t pt-4"
            >
              <label
                v-for="action in actionsFor(resource)"
                :key="action"
                class="flex items-center gap-2 text-sm"
                :class="isActionDisabled(resource, action) ? 'opacity-50' : 'cursor-pointer'"
              >
                <Switch
                  :model-value="permissions[resource]![action]"
                  :disabled="isActionDisabled(resource, action)"
                  @update:model-value="(val: boolean) => onActionToggle(resource, action, val)"
                />
                <span>{{ $t(`rbac.actions.${action}`) }}</span>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <div class="flex justify-end">
      <Button type="submit" :disabled="loading || !name">
        {{ loading ? $t('common.saving') : $t('common.save') }}
      </Button>
    </div>
  </form>
</template>
