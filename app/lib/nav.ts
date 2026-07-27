import { Home, Church, Building2, Users, CalendarDays, Wallet, type LucideIcon } from '@lucide/vue';

export interface NavItem {
  titleKey: string;
  icon: LucideIcon;
  url: string;
  resource: string;
  action: string;
  requiresPermission?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    titleKey: 'sidebar.home',
    icon: Home,
    url: '/',
    resource: 'stats',
    action: 'READ',
    requiresPermission: false,
  },
  {
    titleKey: 'sidebar.congregations',
    icon: Church,
    url: '/congregations',
    resource: 'congregations',
    action: 'READ',
  },
  {
    titleKey: 'sidebar.departments',
    icon: Building2,
    url: '/departments',
    resource: 'departments',
    action: 'READ',
  },
  {
    titleKey: 'sidebar.members',
    icon: Users,
    url: '/members',
    resource: 'members',
    action: 'READ',
  },
  {
    titleKey: 'sidebar.events',
    icon: CalendarDays,
    url: '/events',
    resource: 'events',
    action: 'READ',
  },
  {
    titleKey: 'sidebar.treasury',
    icon: Wallet,
    url: '/treasury',
    resource: 'treasury',
    action: 'READ',
  },
] as const;
