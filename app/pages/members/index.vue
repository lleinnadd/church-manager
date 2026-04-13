<script setup lang="ts">
import {
  Users,
  Shield,
  Network,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from '@lucide/vue';
import { toast } from 'vue-sonner';
import {
  type Member,
  type Congregation,
  type MemberDepartment,
  type Department,
  MemberStatus,
  DepartmentScope,
  CongregationType,
} from '@prisma/client';

const { t } = useI18n();
const { userId } = useAuth();

type MemberWithRelations = Member & {
  congregation: Pick<Congregation, 'id' | 'name' | 'type'>;
  departments: (MemberDepartment & {
    department: Department & {
      localNames?: {
        id: string;
        name: string;
        congregationId: string;
        congregation?: Pick<Congregation, 'id' | 'name' | 'type'> | null;
      }[];
    };
    congregation: Pick<Congregation, 'id' | 'name' | 'type'> | null;
    function?: { id: string; name: string; departmentId: string } | null;
  })[];
};

const { data: members, refresh, status } = useFetch<MemberWithRelations[]>('/api/members');

const isLoading = computed(() => status.value === 'pending');

const deleteTarget = ref<{ id: string; name: string } | null>(null);
const isDeleting = ref(false);
const departmentScrollRefs = ref<Record<string, HTMLElement | null>>({});

function statusLabel(memberStatus: MemberStatus) {
  const labels: Record<MemberStatus, string> = {
    ACTIVE: t('members.status.active'),
    TRANSFERRED: t('members.status.transferred'),
    WITHDRAWN: t('members.status.withdrawn'),
  };
  return labels[memberStatus] ?? memberStatus;
}

function typeLabel(type: CongregationType) {
  const labels: Record<CongregationType, string> = {
    HEADQUARTERS: t('form.congregation.type.headquarters'),
    BRANCH: t('form.congregation.type.branch'),
    SUB_BRANCH: t('form.congregation.type.subBranch'),
  };
  return labels[type] ?? type;
}

function scopeLabel(scope: DepartmentScope | null) {
  if (!scope) return t('departments.scope.none');

  const labels: Record<DepartmentScope, string> = {
    LOCAL: t('departments.scope.local'),
    GENERAL: t('departments.scope.general'),
  };
  return labels[scope] ?? scope;
}

function departmentDisplayName(
  member: MemberWithRelations,
  membership: MemberWithRelations['departments'][number],
) {
  if (membership.scope !== DepartmentScope.LOCAL) return membership.department.name;
  const congregationId = membership.congregation?.id || member.congregation?.id;
  const localName = membership.department.localNames?.find(
    (entry) => entry.congregationId === congregationId,
  )?.name;
  return localName || membership.department.name;
}

function confirmDelete(id: string, name: string) {
  deleteTarget.value = { id, name };
}

function setDepartmentScrollRef(id: string, el: HTMLElement | null) {
  if (!el) return;
  departmentScrollRefs.value[id] = el;
}

function scrollDepartments(id: string, direction: 'left' | 'right') {
  const target = departmentScrollRefs.value[id];
  if (!target) return;
  const delta = direction === 'left' ? -180 : 180;
  target.scrollBy({ left: delta, behavior: 'smooth' });
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/members/${deleteTarget.value.id}`, { method: 'DELETE' });
    toast.success(t('pages.members.deleteSuccess'));
    await refresh();
  } catch {
    toast.error(t('pages.members.deleteError'));
  } finally {
    isDeleting.value = false;
    deleteTarget.value = null;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('pages.members.title') }}</h1>
        <p class="text-muted-foreground text-sm">{{ $t('pages.members.description') }}</p>
      </div>
      <div class="flex gap-2">
        <Button as-child>
          <NuxtLink to="/members/new">
            <Plus class="mr-2 size-4" />
            {{ $t('pages.members.new') }}
          </NuxtLink>
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="i in 3" :key="i" class="h-48 w-full rounded-xl" />
    </div>

    <Empty v-else-if="!members?.length" class="min-h-100">
      <EmptyMedia variant="icon">
        <Users class="size-8" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{{ $t('pages.members.emptyTitle') }}</EmptyTitle>
        <EmptyDescription>{{ $t('pages.members.emptyDescription') }}</EmptyDescription>
      </EmptyHeader>
    </Empty>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="member in members" :key="member.id" class="group relative">
        <CardHeader class="space-y-2">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <CardTitle class="truncate text-lg">{{ member.name }}</CardTitle>
              <CardDescription class="flex items-center gap-2">
                <span class="text-muted-foreground font-medium">#{{ member.memberNumber }}</span>
                <span class="text-muted-foreground">·</span>
                <Shield class="size-4 text-muted-foreground" />
                <span>{{ statusLabel(member.status) }}</span>
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm">
                  <span class="sr-only">{{ $t('common.actions') }}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem as-child>
                  <NuxtLink :to="`/members/${member.id}/edit`">
                    <Pencil class="mr-2 size-4" />
                    {{ $t('common.edit') }}
                  </NuxtLink>
                </DropdownMenuItem>
                <template v-if="member.clerkUserId !== userId">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="text-destructive"
                    @select="confirmDelete(member.id, member.name)"
                  >
                    <Trash2 class="mr-2 size-4" />
                    {{ $t('common.delete') }}
                  </DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="text-xs text-muted-foreground flex items-center gap-2">
            <Network class="size-4" />
            <span>
              {{ member.congregation.name }} • {{ typeLabel(member.congregation.type) }}
            </span>
          </div>
          <div class="space-y-2">
            <p class="text-sm font-medium">{{ $t('pages.members.departments') }}</p>
            <div v-if="member.departments.length" class="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                class="absolute left-0 top-1/2 z-10 h-5.5 w-5.5 -translate-y-1/2 -translate-x-1 rounded-full border bg-background/70 p-0 shadow-sm opacity-0 transition-all duration-200 pointer-events-none hover:bg-background/90 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0"
                :aria-label="$t('common.scrollLeft')"
                @click="scrollDepartments(member.id, 'left')"
              >
                <ChevronLeft class="size-3" />
              </Button>
              <div
                :ref="(el) => setDepartmentScrollRef(member.id, el as HTMLElement | null)"
                class="no-scrollbar w-full overflow-x-auto rounded-full"
              >
                <div class="flex flex-nowrap gap-2">
                  <Badge
                    v-for="membership in member.departments"
                    :key="membership.id"
                    variant="secondary"
                  >
                    <span class="font-medium">{{ departmentDisplayName(member, membership) }}</span>
                    <template v-if="membership.scope">
                      <span class="mx-1">•</span>
                      <span>{{ scopeLabel(membership.scope) }}</span>
                    </template>
                    <template v-if="membership.function">
                      <span class="mx-1">•</span>
                      <span>{{ membership.function.name }}</span>
                    </template>
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                class="absolute right-0 top-1/2 z-10 h-5.5 w-5.5 -translate-y-1/2 translate-x-1 rounded-full border bg-background/70 p-0 shadow-sm opacity-0 transition-all duration-200 pointer-events-none hover:bg-background/90 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0"
                :aria-label="$t('common.scrollRight')"
                @click="scrollDepartments(member.id, 'right')"
              >
                <ChevronRight class="size-3" />
              </Button>
            </div>
            <p v-else class="text-muted-foreground text-sm">
              {{ $t('pages.members.noDepartments') }}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    <ConfirmDialog
      :open="!!deleteTarget"
      :title="$t('pages.members.deleteTitle')"
      :description="$t('pages.members.deleteDescription', { name: deleteTarget?.name })"
      :confirm-label="$t('common.delete')"
      variant="destructive"
      :loading="isDeleting"
      @confirm="handleDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>

<style scoped>
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
