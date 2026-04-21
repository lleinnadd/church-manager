import type {
  CongregationType,
  EventSeriesType,
  MaritalStatus,
  MemberStatus,
} from '@prisma/client';

export type AgeRangeKey = '0-12' | '13-17' | '18-29' | '30-59' | '60+';

export interface DashboardCongregationLite {
  id: string;
  name: string;
  type: CongregationType;
}

export interface DashboardViewer {
  memberId: string | null;
  memberName: string | null;
  congregation: DashboardCongregationLite | null;
  nextEvent: DashboardUpcomingEvent | null;
}

export interface DashboardScope {
  congregationId: string | null;
  congregationName: string | null;
  congregationType: CongregationType | null;
  isGlobal: boolean;
}

export interface DashboardMemberLite {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface DashboardNewMember extends DashboardMemberLite {
  memberSince: string | null;
}

export interface DashboardBirthdayMember extends DashboardMemberLite {
  dateOfBirth: string;
  dayOfMonth: number;
}

export interface DashboardMembersSection {
  total: number;
  byStatus: Record<MemberStatus, number>;
  byMaritalStatus: Record<MaritalStatus, number> & { UNKNOWN: number };
  byAgeRange: Record<AgeRangeKey, number> & { UNKNOWN: number };
  newLast30: number;
  newMembers: DashboardNewMember[];
  birthdaysThisMonth: DashboardBirthdayMember[];
  photoCoverage: { withPhoto: number; total: number };
  platformAdoption: { withClerk: number; total: number };
  withoutCongregation: number;
  withoutDepartment: number;
  incompleteProfiles: number;
}

export interface DashboardUpcomingEvent {
  id: string;
  seriesId: string;
  title: string;
  startAt: string;
  endAt: string;
  cancelled: boolean;
  isException: boolean;
  eventType: EventSeriesType;
  congregation: DashboardCongregationLite | null;
  department: { id: string; name: string } | null;
}

export interface DashboardEventsByDepartment {
  departmentId: string;
  departmentName: string;
  count: number;
}

export interface DashboardEventsSection {
  todayCount: number;
  next7Days: number;
  monthTotal: number;
  cancelledThisMonth: number;
  cancellationRate: number;
  byType: Record<EventSeriesType, number>;
  upcoming: DashboardUpcomingEvent[];
  upcomingDates: string[];
  byDepartment: DashboardEventsByDepartment[];
}

export interface DashboardLeadershipEntry {
  congregationId: string;
  congregationName: string;
  responsibles: { memberName: string; functionName: string }[];
}

export interface DashboardCongregationsSection {
  total: number;
  byType: Record<CongregationType, number>;
  byState: { state: string; count: number }[];
  leadership: DashboardLeadershipEntry[];
  withoutLeadership: { id: string; name: string }[];
}

export interface DashboardTopDepartment {
  id: string;
  name: string;
  memberCount: number;
}

export interface DashboardDepartmentsSection {
  total: number;
  withScopeDivision: number;
  withoutScopeDivision: number;
  totalFunctions: number;
  topByMembers: DashboardTopDepartment[];
  withoutMembers: { id: string; name: string }[];
}

export interface DashboardStatsPayload {
  viewer: DashboardViewer;
  scope: DashboardScope;
  congregations: DashboardCongregationLite[];
  members: DashboardMembersSection;
  events: DashboardEventsSection;
  congregationsStats: DashboardCongregationsSection;
  departments: DashboardDepartmentsSection;
}
