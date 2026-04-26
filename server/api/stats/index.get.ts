import {
  CongregationType,
  EventSeriesType,
  MaritalStatus,
  MemberStatus,
  Prisma,
} from '@prisma/client';
import { z } from 'zod';
import type {
  AgeRangeKey,
  DashboardCongregationLite,
  DashboardScope,
  DashboardStatsPayload,
  DashboardUpcomingEvent,
} from '~~/shared/types/stats';

const querySchema = z.object({
  congregationId: z.string().min(1).optional(),
});

const UPCOMING_WINDOW_DAYS = 60;

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function ageFromDob(dob: Date, today: Date): number {
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function ageRangeOf(age: number): AgeRangeKey {
  if (age <= 12) return '0-12';
  if (age <= 17) return '13-17';
  if (age <= 29) return '18-29';
  if (age <= 59) return '30-59';
  return '60+';
}

function isoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default defineEventHandler(async (event): Promise<DashboardStatsPayload> => {
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params' });
  }

  const auth = (event.context.auth as () => { userId: string | null })();
  const clerkUserId = auth?.userId ?? null;

  const viewerMember = clerkUserId
    ? await prisma.member.findUnique({
        where: { clerkUserId },
        select: {
          id: true,
          name: true,
          congregationId: true,
          congregation: { select: { id: true, name: true, type: true } },
          departments: { select: { departmentId: true, congregationId: true } },
        },
      })
    : null;

  const allCongregations = await prisma.congregation.findMany({
    select: { id: true, name: true, type: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  let scopeCongregation: DashboardCongregationLite | null = null;
  if (parsed.data.congregationId) {
    scopeCongregation = allCongregations.find((c) => c.id === parsed.data.congregationId) ?? null;
    if (!scopeCongregation) {
      throw createError({ statusCode: 404, statusMessage: 'Congregation not found' });
    }
  } else if (
    viewerMember?.congregation &&
    viewerMember.congregation.type !== CongregationType.HEADQUARTERS
  ) {
    scopeCongregation = viewerMember.congregation;
  }

  const scope: DashboardScope = {
    congregationId: scopeCongregation?.id ?? null,
    congregationName: scopeCongregation?.name ?? null,
    congregationType: scopeCongregation?.type ?? null,
    isGlobal: !scopeCongregation,
  };

  const memberCongregationFilter: Prisma.MemberWhereInput = scopeCongregation
    ? { congregationId: scopeCongregation.id }
    : {};

  const eventCongregationFilter = scopeCongregation ? { congregationId: scopeCongregation.id } : {};

  const now = new Date();
  const today = startOfDayUtc(now);
  const tomorrow = addDaysUtc(today, 1);
  const sevenDaysOut = addDaysUtc(today, 7);
  const monthStart = startOfMonthUtc(now);
  const nextMonthStart = startOfNextMonthUtc(now);
  const upcomingWindowEnd = addDaysUtc(today, UPCOMING_WINDOW_DAYS);
  const last30 = addDaysUtc(today, -30);

  const [
    statusGroups,
    maritalGroups,
    membersForBirthdaysAndAges,
    newMembersList,
    newLast30Count,
    photoCount,
    clerkCount,
    membersTotal,
    withoutCongregationCount,
    withoutDepartmentCount,
    incompleteCount,
  ] = await Promise.all([
    prisma.member.groupBy({
      by: ['status'],
      where: memberCongregationFilter,
      _count: { _all: true },
    }),
    prisma.member.groupBy({
      by: ['maritalStatus'],
      where: memberCongregationFilter,
      _count: { _all: true },
    }),
    prisma.member.findMany({
      where: { ...memberCongregationFilter, dateOfBirth: { not: null } },
      select: { id: true, name: true, photoUrl: true, dateOfBirth: true },
    }),
    prisma.member.findMany({
      where: { ...memberCongregationFilter, memberSince: { gte: last30 } },
      orderBy: { memberSince: 'desc' },
      take: 5,
      select: { id: true, name: true, photoUrl: true, memberSince: true },
    }),
    prisma.member.count({
      where: { ...memberCongregationFilter, memberSince: { gte: last30 } },
    }),
    prisma.member.count({
      where: { ...memberCongregationFilter, photoUrl: { not: null } },
    }),
    prisma.member.count({
      where: { ...memberCongregationFilter, clerkUserId: { not: null } },
    }),
    prisma.member.count({ where: memberCongregationFilter }),
    scopeCongregation
      ? Promise.resolve(0)
      : prisma.member.count({ where: { congregationId: null } }),
    prisma.member.count({
      where: {
        ...memberCongregationFilter,
        departments: { none: {} },
      },
    }),
    prisma.member.count({
      where: {
        ...memberCongregationFilter,
        OR: [{ phonePrimary: null }, { dateOfBirth: null }, { photoUrl: null }],
      },
    }),
  ]);

  const byStatus: Record<MemberStatus, number> = {
    ACTIVE: 0,
    TRANSFERRED: 0,
    WITHDRAWN: 0,
  };
  for (const group of statusGroups) {
    byStatus[group.status] = group._count._all;
  }

  const byMaritalStatus: Record<MaritalStatus, number> & { UNKNOWN: number } = {
    SINGLE: 0,
    MARRIED: 0,
    DIVORCED: 0,
    WIDOWED: 0,
    SEPARATED: 0,
    UNKNOWN: 0,
  };
  for (const group of maritalGroups) {
    if (group.maritalStatus) {
      byMaritalStatus[group.maritalStatus] = group._count._all;
    } else {
      byMaritalStatus.UNKNOWN = group._count._all;
    }
  }

  const byAgeRange: Record<AgeRangeKey, number> & { UNKNOWN: number } = {
    '0-12': 0,
    '13-17': 0,
    '18-29': 0,
    '30-59': 0,
    '60+': 0,
    UNKNOWN: 0,
  };
  const birthdays: DashboardStatsPayload['members']['birthdaysThisMonth'] = [];
  const currentMonth = today.getUTCMonth();
  const totalWithDob = membersForBirthdaysAndAges.length;
  byAgeRange.UNKNOWN = membersTotal - totalWithDob;

  for (const m of membersForBirthdaysAndAges) {
    if (!m.dateOfBirth) continue;
    const dob = new Date(m.dateOfBirth);
    const age = ageFromDob(dob, today);
    if (age >= 0) {
      byAgeRange[ageRangeOf(age)] += 1;
    }
    if (dob.getUTCMonth() === currentMonth) {
      birthdays.push({
        id: m.id,
        name: m.name,
        photoUrl: m.photoUrl,
        dateOfBirth: dob.toISOString(),
        dayOfMonth: dob.getUTCDate(),
      });
    }
  }
  birthdays.sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  const [seriesList, cancelledOccurrences, exceptionOccurrences, allDepartmentsLite] =
    await Promise.all([
      prisma.eventSeries.findMany({
        where: {
          startsOn: { lt: upcomingWindowEnd },
          OR: [
            { eventType: EventSeriesType.MONTHLY_RECURRING, endsOn: null },
            { endsOn: { gte: today } },
          ],
          ...eventCongregationFilter,
        },
        include: {
          daySchedules: { orderBy: { date: 'asc' } },
          congregation: { select: { id: true, name: true, type: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.eventOccurrence.count({
        where: {
          ...eventCongregationFilter,
          cancelled: true,
          occurrenceDate: { gte: monthStart, lt: nextMonthStart },
        },
      }),
      prisma.eventOccurrence.findMany({
        where: {
          ...eventCongregationFilter,
          isException: true,
          startAt: { lt: upcomingWindowEnd },
          endAt: { gt: today },
        },
        include: {
          congregation: { select: { id: true, name: true, type: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.department.findMany({ select: { id: true, name: true } }),
    ]);

  const departmentNameById = new Map(allDepartmentsLite.map((d) => [d.id, d.name]));

  const exceptionBySeriesAndDate = new Map<string, (typeof exceptionOccurrences)[number]>();
  for (const exc of exceptionOccurrences) {
    const key = `${exc.seriesId}:${isoDateKey(exc.occurrenceDate)}`;
    if (!exceptionBySeriesAndDate.has(key)) exceptionBySeriesAndDate.set(key, exc);
  }
  const consumedExceptions = new Set<string>();

  interface GeneratedOccurrence {
    id: string;
    seriesId: string;
    title: string;
    startAt: Date;
    endAt: Date;
    occurrenceDate: Date;
    cancelled: boolean;
    isException: boolean;
    congregation: { id: string; name: string; type: CongregationType } | null;
    departmentId: string | null;
  }

  const generated: GeneratedOccurrence[] = [];
  for (const series of seriesList) {
    const drafts = buildOccurrencesForSeriesRange(series, today, upcomingWindowEnd);
    for (const draft of drafts) {
      const key = `${series.id}:${isoDateKey(draft.occurrenceDate)}`;
      const exc = exceptionBySeriesAndDate.get(key);
      if (exc) {
        consumedExceptions.add(exc.id);
        if (!exc.cancelled) {
          generated.push({
            id: exc.id,
            seriesId: series.id,
            title: exc.title,
            startAt: exc.startAt,
            endAt: exc.endAt,
            occurrenceDate: exc.occurrenceDate,
            cancelled: false,
            isException: true,
            congregation: exc.congregation,
            departmentId: exc.departmentId,
          });
        }
        continue;
      }
      generated.push({
        id: `virtual:${series.id}:${isoDateKey(draft.occurrenceDate)}`,
        seriesId: series.id,
        title: draft.title,
        startAt: draft.startAt,
        endAt: draft.endAt,
        occurrenceDate: draft.occurrenceDate,
        cancelled: false,
        isException: false,
        congregation: series.congregation,
        departmentId: series.departmentId,
      });
    }
  }
  for (const exc of exceptionOccurrences) {
    if (consumedExceptions.has(exc.id)) continue;
    if (exc.cancelled) continue;
    generated.push({
      id: exc.id,
      seriesId: exc.seriesId,
      title: exc.title,
      startAt: exc.startAt,
      endAt: exc.endAt,
      occurrenceDate: exc.occurrenceDate,
      cancelled: false,
      isException: true,
      congregation: exc.congregation,
      departmentId: exc.departmentId,
    });
  }

  generated.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const upcomingDatesSet = new Set<string>();
  let todayCount = 0;
  let next7Days = 0;
  let monthTotal = 0;
  const byDepartmentCount = new Map<string, number>();
  const byType: Record<EventSeriesType, number> = {
    SINGLE_DAY: 0,
    MULTI_DAY: 0,
    MONTHLY_RECURRING: 0,
  };
  const seriesById = new Map(seriesList.map((s) => [s.id, s]));

  for (const occ of generated) {
    upcomingDatesSet.add(isoDateKey(occ.occurrenceDate));
    if (occ.startAt >= today && occ.startAt < tomorrow) todayCount += 1;
    if (occ.startAt >= today && occ.startAt < sevenDaysOut) next7Days += 1;
    if (occ.startAt >= monthStart && occ.startAt < nextMonthStart) monthTotal += 1;
    if (occ.departmentId) {
      byDepartmentCount.set(occ.departmentId, (byDepartmentCount.get(occ.departmentId) ?? 0) + 1);
    }
    const series = seriesById.get(occ.seriesId);
    if (series) byType[series.eventType] += 1;
  }

  const upcoming: DashboardUpcomingEvent[] = generated.slice(0, 10).map((occ) => ({
    id: occ.id,
    seriesId: occ.seriesId,
    title: occ.title,
    startAt: occ.startAt.toISOString(),
    endAt: occ.endAt.toISOString(),
    cancelled: occ.cancelled,
    isException: occ.isException,
    eventType: seriesById.get(occ.seriesId)?.eventType ?? EventSeriesType.SINGLE_DAY,
    congregation: occ.congregation,
    department: occ.departmentId
      ? { id: occ.departmentId, name: departmentNameById.get(occ.departmentId) ?? '' }
      : null,
  }));

  const byDepartmentList = Array.from(byDepartmentCount.entries())
    .map(([departmentId, count]) => ({
      departmentId,
      departmentName: departmentNameById.get(departmentId) ?? '',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const cancellationDenominator = monthTotal + cancelledOccurrences;
  const cancellationRate = cancellationDenominator
    ? cancelledOccurrences / cancellationDenominator
    : 0;

  let viewerNextEvent: DashboardUpcomingEvent | null = null;
  if (viewerMember) {
    const viewerDepartmentIds = new Set(viewerMember.departments.map((d) => d.departmentId));
    const match = generated.find(
      (occ) =>
        occ.congregation?.id === viewerMember.congregationId ||
        (occ.departmentId && viewerDepartmentIds.has(occ.departmentId)),
    );
    if (match) {
      viewerNextEvent = {
        id: match.id,
        seriesId: match.seriesId,
        title: match.title,
        startAt: match.startAt.toISOString(),
        endAt: match.endAt.toISOString(),
        cancelled: match.cancelled,
        isException: match.isException,
        eventType: seriesById.get(match.seriesId)?.eventType ?? EventSeriesType.SINGLE_DAY,
        congregation: match.congregation,
        department: match.departmentId
          ? { id: match.departmentId, name: departmentNameById.get(match.departmentId) ?? '' }
          : null,
      };
    }
  }

  const [congTypeGroups, congregationsForState, leadershipMap] = await Promise.all([
    scopeCongregation
      ? Promise.resolve([
          {
            type: scopeCongregation.type,
            _count: { _all: 1 },
          },
        ] as { type: CongregationType; _count: { _all: number } }[])
      : prisma.congregation.groupBy({
          by: ['type'],
          _count: { _all: true },
        }),
    scopeCongregation
      ? prisma.congregation.findMany({
          where: { id: scopeCongregation.id },
          select: { id: true, name: true, state: true },
        })
      : prisma.congregation.findMany({ select: { id: true, name: true, state: true } }),
    getCongregationLeadershipMap(
      prisma,
      scopeCongregation ? [scopeCongregation.id] : allCongregations.map((c) => c.id),
    ),
  ]);

  const byCongregationType: Record<CongregationType, number> = {
    HEADQUARTERS: 0,
    BRANCH: 0,
    SUB_BRANCH: 0,
  };
  for (const group of congTypeGroups) {
    byCongregationType[group.type] = group._count._all;
  }

  const stateCount = new Map<string, number>();
  for (const c of congregationsForState) {
    if (!c.state) continue;
    stateCount.set(c.state, (stateCount.get(c.state) ?? 0) + 1);
  }
  const byState = Array.from(stateCount.entries())
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const leadership: DashboardStatsPayload['congregationsStats']['leadership'] = [];
  const withoutLeadership: { id: string; name: string }[] = [];
  const congregationsForLeadership = scopeCongregation
    ? allCongregations.filter((c) => c.id === scopeCongregation.id)
    : allCongregations;
  for (const c of congregationsForLeadership) {
    const data = leadershipMap.get(c.id);
    if (data && data.responsibles.length) {
      leadership.push({
        congregationId: c.id,
        congregationName: c.name,
        responsibles: data.responsibles.slice(0, 4).map((r) => ({
          memberName: r.memberName,
          functionName: r.functionName,
        })),
      });
    } else {
      withoutLeadership.push({ id: c.id, name: c.name });
    }
  }
  leadership.sort((a, b) => b.responsibles.length - a.responsibles.length);

  const departmentMembershipFilter = scopeCongregation
    ? {
        OR: [
          { congregationId: scopeCongregation.id },
          {
            AND: [{ congregationId: null }, { member: { congregationId: scopeCongregation.id } }],
          },
        ],
      }
    : {};

  const [departments, totalFunctions] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        name: true,
        hasScopeDivision: true,
        memberships: {
          where: departmentMembershipFilter,
          select: { memberId: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.departmentFunction.count(),
  ]);

  let withScopeDivision = 0;
  let withoutScopeDivision = 0;
  const topByMembers: DashboardStatsPayload['departments']['topByMembers'] = [];
  const withoutMembers: { id: string; name: string }[] = [];
  for (const d of departments) {
    if (d.hasScopeDivision) withScopeDivision += 1;
    else withoutScopeDivision += 1;
    const uniqueMemberIds = new Set(d.memberships.map((m) => m.memberId));
    const count = uniqueMemberIds.size;
    topByMembers.push({ id: d.id, name: d.name, memberCount: count });
    if (count === 0) withoutMembers.push({ id: d.id, name: d.name });
  }
  topByMembers.sort((a, b) => b.memberCount - a.memberCount);

  return {
    viewer: {
      memberId: viewerMember?.id ?? null,
      memberName: viewerMember?.name ?? null,
      congregation: viewerMember?.congregation ?? null,
      nextEvent: viewerNextEvent,
    },
    scope,
    congregations: allCongregations,
    members: {
      total: membersTotal,
      byStatus,
      byMaritalStatus,
      byAgeRange,
      newLast30: newLast30Count,
      newMembers: newMembersList.map((m) => ({
        id: m.id,
        name: m.name,
        photoUrl: m.photoUrl,
        memberSince: m.memberSince ? m.memberSince.toISOString() : null,
      })),
      birthdaysThisMonth: birthdays,
      photoCoverage: { withPhoto: photoCount, total: membersTotal },
      platformAdoption: { withClerk: clerkCount, total: membersTotal },
      withoutCongregation: withoutCongregationCount,
      withoutDepartment: withoutDepartmentCount,
      incompleteProfiles: incompleteCount,
    },
    events: {
      todayCount,
      next7Days,
      monthTotal,
      cancelledThisMonth: cancelledOccurrences,
      cancellationRate,
      byType,
      upcoming,
      upcomingDates: Array.from(upcomingDatesSet).sort(),
      byDepartment: byDepartmentList,
    },
    congregationsStats: {
      total: scopeCongregation ? 1 : allCongregations.length,
      byType: byCongregationType,
      byState,
      leadership: leadership.slice(0, 6),
      withoutLeadership: withoutLeadership.slice(0, 6),
    },
    departments: {
      total: departments.length,
      withScopeDivision,
      withoutScopeDivision,
      totalFunctions,
      topByMembers: topByMembers.slice(0, 5),
      withoutMembers: withoutMembers.slice(0, 5),
    },
  };
});
