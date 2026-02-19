<script setup lang="ts">
import { Home, Users, CalendarDays, Settings, ChevronUp, Church, Building2 } from 'lucide-vue-next';
import { dark } from '@clerk/themes';
import { useSidebar } from '@/components/ui/sidebar/utils';

const { t } = useI18n();
const { user } = useUser();
const clerk = useClerk();
const { state } = useSidebar();

const isCollapsed = computed(() => state.value === 'collapsed');

const menuItems = computed(() => [
  { title: t('sidebar.home'), icon: Home, url: '/' },
  { title: t('sidebar.congregations'), icon: Church, url: '/congregations' },
  { title: t('sidebar.departments'), icon: Building2, url: '/departments' },
  { title: t('sidebar.members'), icon: Users, url: '/members' },
  { title: t('sidebar.events'), icon: CalendarDays, url: '/events' },
  { title: t('sidebar.settings'), icon: Settings, url: '/settings' },
]);

async function handleSignOut() {
  await clerk.value?.signOut({ redirectUrl: '/auth/sign-in' });
}

function handleManageAccount() {
  clerk.value?.openUserProfile({
    appearance: { baseTheme: dark },
  });
}

const userInitials = computed(() => {
  const first = user.value?.firstName?.[0] ?? '';
  const last = user.value?.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
});

const userFullName = computed(() => {
  return user.value?.fullName ?? t('sidebar.userFallback');
});

const userEmail = computed(() => {
  return user.value?.primaryEmailAddress?.emailAddress ?? '';
});
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader class="p-2">
      <div class="flex items-center justify-center">
        <img
          v-if="!isCollapsed"
          src="/logos/rectangle_dark.png"
          :alt="$t('app.name')"
          class="hidden w-full h-auto dark:block"
        />
        <img
          v-if="!isCollapsed"
          src="/logos/rectangle_light.png"
          :alt="$t('app.name')"
          class="block w-full h-auto dark:hidden"
        />
        <img
          v-if="isCollapsed"
          src="/logos/square_dark.png"
          :alt="$t('app.name')"
          class="hidden size-8 dark:block"
        />
        <img
          v-if="isCollapsed"
          src="/logos/square_light.png"
          :alt="$t('app.name')"
          class="block size-8 dark:hidden"
        />
      </div>
    </SidebarHeader>

    <SidebarSeparator />

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>{{ $t('sidebar.menu') }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in menuItems" :key="item.title">
              <SidebarMenuButton as-child :tooltip="item.title">
                <NuxtLink :to="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter v-if="user">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                size="lg"
                class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar class="size-8 rounded-lg">
                  <AvatarImage :src="user?.imageUrl" :alt="userFullName" />
                  <AvatarFallback class="rounded-lg">{{ userInitials }}</AvatarFallback>
                </Avatar>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">{{ userFullName }}</span>
                  <span class="truncate text-xs text-muted-foreground">{{ userEmail }}</span>
                </div>
                <ChevronUp class="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              class="w-[--reka-popper-anchor-width] min-w-56"
              side="top"
              align="start"
            >
              <DropdownMenuItem @click="handleManageAccount">
                {{ $t('sidebar.manageAccount') }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="handleSignOut">
                {{ $t('sidebar.signOut') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
</template>
