import * as React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Path,
  Circle,
  renderToBuffer,
} from '@react-pdf/renderer';

type StyleValue = ReturnType<typeof StyleSheet.create>[string];

export interface CalendarEvent {
  title: string;
  startAt: Date;
  endAt: Date;
  eventType: string;
  congregationName?: string | null;
  departmentName?: string | null;
}

export interface MonthData {
  year: number;
  month: number; // 0-indexed
  events: CalendarEvent[];
}

export type ExportLocale = 'pt-BR' | 'en';

const h = React.createElement;

// A4 landscape (in points): 842 x 595
const PAGE_PADDING = 18;

// Cores derivadas das variáveis --chart-* do módulo de eventos (dark mode),
// convertidas de oklch para hex já que @react-pdf/renderer não suporta oklch nem color-mix.
// chart-2 (verde) → recorrente | chart-1 (azul/violeta) → multi-dia | chart-5 (rosa) → único
const EVENT_COLORS: Record<string, { accent: string; bg: string; text: string }> = {
  MONTHLY_RECURRING: { accent: '#2dc09a', bg: '#d4f5ea', text: '#0e3d2c' },
  MULTI_DAY: { accent: '#4843db', bg: '#dedef9', text: '#1d1c4a' },
  SINGLE_DAY: { accent: '#e54969', bg: '#fadce5', text: '#5a1828' },
};

function eventColor(type: string) {
  return EVENT_COLORS[type] ?? EVENT_COLORS.SINGLE_DAY!;
}

const styles = StyleSheet.create({
  page: {
    padding: PAGE_PADDING,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#111827',
  },
  headerYear: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
  },
  body: {
    flexDirection: 'row',
    flex: 1,
  },
  sidebar: {
    width: 175,
    flexDirection: 'column',
    marginRight: 10,
    gap: 8,
  },
  mainArea: {
    flex: 1,
    flexDirection: 'column',
  },
  mini: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 3,
    padding: 5,
    backgroundColor: '#f9fafb',
    flex: 1,
    flexDirection: 'column',
  },
  miniCurrent: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  miniHeader: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
    color: '#111827',
  },
  miniRow: {
    flexDirection: 'row',
  },
  miniWeekRows: {
    flex: 1,
    flexDirection: 'column',
  },
  miniWeekRow: {
    flexDirection: 'row',
    flex: 1,
  },
  miniCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    position: 'relative',
  },
  miniDayDisc: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 11,
    height: 11,
    marginTop: -5.5,
    marginLeft: -5.5,
  },
  miniDayOnDisc: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  miniWeekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  miniWeekday: {
    fontSize: 6,
    color: '#6b7280',
    fontFamily: 'Helvetica-Bold',
  },
  miniDay: {
    fontSize: 7,
    color: '#1f2937',
  },
  miniDayMuted: {
    fontSize: 7,
    color: '#d1d5db',
  },
  calendarGrid: {
    borderWidth: 1,
    borderColor: '#9ca3af',
    flex: 1,
    flexDirection: 'column',
  },
  weekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#9ca3af',
    backgroundColor: '#f3f4f6',
  },
  weekHeaderCell: {
    flex: 1,
    padding: 3,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#374151',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
  },
  weekHeaderCellLast: {
    borderRightWidth: 0,
  },
  weekRow: {
    flexDirection: 'row',
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  weekRowLast: {
    borderBottomWidth: 0,
  },
  dayCell: {
    flex: 1,
    padding: 2,
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
    flexDirection: 'column',
  },
  dayCellLast: {
    borderRightWidth: 0,
  },
  dayCellMuted: {
    backgroundColor: '#fafafa',
  },
  dayNumber: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  dayNumberMuted: {
    color: '#cbd5e1',
  },
  dayNumberWeekend: {
    color: '#dc2626',
  },
  eventPill: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    borderLeftWidth: 2,
    marginBottom: 1,
    flexDirection: 'column',
  },
  eventTitleLine: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
  },
  eventMetaLine: {
    fontSize: 5.5,
    fontFamily: 'Helvetica-Oblique',
  },
  moreEvents: {
    fontSize: 6,
    color: '#6b7280',
    fontStyle: 'italic',
    paddingHorizontal: 3,
  },
});

const WEEKDAY_LABELS_SHORT: Record<ExportLocale, string[]> = {
  'pt-BR': ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

const WEEKDAY_LABELS_LONG: Record<ExportLocale, string[]> = {
  'pt-BR': ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

function monthName(year: number, month: number, locale: ExportLocale): string {
  return new Date(year, month, 1).toLocaleDateString(locale, { month: 'long' });
}

function formatTime(date: Date, timezone: string, locale: ExportLocale): string {
  return date.toLocaleTimeString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale === 'en',
    timeZone: timezone,
  });
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

interface CalendarCell {
  day: number;
  isCurrentMonth: boolean;
  date: Date;
}

function buildMonthGrid(year: number, month: number, padToWeeks?: number): CalendarCell[][] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    cells.push({ day, isCurrentMonth: false, date: new Date(year, month - 1, day) });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, isCurrentMonth: true, date: new Date(year, month, day) });
  }

  const targetCells = padToWeeks ? padToWeeks * 7 : Math.ceil(cells.length / 7) * 7;
  let trailingDay = 1;
  while (cells.length < targetCells) {
    cells.push({
      day: trailingDay,
      isCurrentMonth: false,
      date: new Date(year, month + 1, trailingDay),
    });
    trailingDay += 1;
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function EventDisc(props: { types: string[] }) {
  const { types } = props;
  const size = 11;
  const r = size / 2;
  const cx = r;
  const cy = r;

  if (types.length === 1) {
    return h(
      Svg,
      { style: styles.miniDayDisc, viewBox: `0 0 ${size} ${size}` },
      h(Circle, { cx, cy, r, fill: eventColor(types[0]!).accent }),
    );
  }

  // Build pie slices using SVG arc paths.
  const slices = types.map((type, idx) => {
    const startAngle = (idx / types.length) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((idx + 1) / types.length) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const d = [
      `M ${cx} ${cy}`,
      `L ${x1.toFixed(3)} ${y1.toFixed(3)}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
      'Z',
    ].join(' ');
    return h(Path, { key: `slice-${idx}`, d, fill: eventColor(type).accent });
  });

  return h(Svg, { style: styles.miniDayDisc, viewBox: `0 0 ${size} ${size}` }, ...slices);
}

function MiniCalendar(props: {
  year: number;
  month: number;
  locale: ExportLocale;
  highlight?: boolean;
  eventsByDate?: Map<string, CalendarEvent[]>;
  timezone?: string;
}) {
  const { year, month, locale, highlight, eventsByDate, timezone } = props;
  const weeks = buildMonthGrid(year, month, 6);
  const label = `${monthName(year, month, locale)} ${year}`;

  const weekdayRow = h(
    View,
    { style: styles.miniRow, key: 'weekdays' },
    WEEKDAY_LABELS_SHORT[locale].map((wd, idx) =>
      h(
        View,
        { style: styles.miniWeekdayCell, key: `wd-${idx}` },
        h(Text, { style: styles.miniWeekday }, wd),
      ),
    ),
  );

  const weekRows = weeks.map((week, weekIdx) =>
    h(
      View,
      { style: styles.miniWeekRow, key: `wk-${weekIdx}` },
      week.map((cell, dayIdx) => {
        const dateKey =
          eventsByDate && timezone
            ? cell.date.toLocaleDateString('en-CA', { timeZone: timezone })
            : null;
        const cellEvents = dateKey && cell.isCurrentMonth ? (eventsByDate!.get(dateKey) ?? []) : [];

        // Deduplicate by event type — each unique type becomes one slice of the disc.
        const sliceTypes = cellEvents.reduce<string[]>((acc, ev) => {
          if (!acc.includes(ev.eventType)) acc.push(ev.eventType);
          return acc;
        }, []);

        return h(
          View,
          { style: styles.miniCell, key: `c-${weekIdx}-${dayIdx}` },
          sliceTypes.length > 0 ? h(EventDisc, { types: sliceTypes, key: 'disc' }) : null,
          h(
            Text,
            {
              style: (() => {
                if (sliceTypes.length > 0) return styles.miniDayOnDisc;
                if (cell.isCurrentMonth) return styles.miniDay;
                return styles.miniDayMuted;
              })(),
            },
            String(cell.day),
          ),
        );
      }),
    ),
  );

  return h(
    View,
    { style: highlight ? [styles.mini, styles.miniCurrent] : styles.mini },
    h(Text, { style: styles.miniHeader }, label),
    weekdayRow,
    h(View, { style: styles.miniWeekRows }, ...weekRows),
  );
}

function eventLabel(ev: CalendarEvent, timezone: string, locale: ExportLocale): string {
  const time = formatTime(ev.startAt, timezone, locale);
  return `${time} ${ev.title}`;
}

function eventMetaLine(ev: CalendarEvent): string | null {
  const parts: string[] = [];
  if (ev.departmentName) parts.push(ev.departmentName);
  if (ev.congregationName) parts.push(ev.congregationName);
  return parts.length ? parts.join(' • ') : null;
}

function MainCalendar(props: {
  year: number;
  month: number;
  events: CalendarEvent[];
  locale: ExportLocale;
  timezone: string;
}) {
  const { year, month, events, locale, timezone } = props;
  const weeks = buildMonthGrid(year, month, 6);

  const eventsByDay = new Map<string, CalendarEvent[]>();
  events.forEach((ev) => {
    const key = ev.startAt.toLocaleDateString('en-CA', { timeZone: timezone });
    const list = eventsByDay.get(key) ?? [];
    list.push(ev);
    eventsByDay.set(key, list);
  });

  const headerRow = h(
    View,
    { style: styles.weekHeader },
    WEEKDAY_LABELS_LONG[locale].map((label, idx) =>
      h(
        Text,
        {
          key: `wh-${idx}`,
          style:
            idx === 6 ? [styles.weekHeaderCell, styles.weekHeaderCellLast] : styles.weekHeaderCell,
        },
        label,
      ),
    ),
  );

  const MAX_EVENTS_PER_DAY = 3;

  const rows = weeks.map((week, weekIdx) => {
    const isLastWeek = weekIdx === weeks.length - 1;
    return h(
      View,
      {
        key: `wk-${weekIdx}`,
        style: isLastWeek ? [styles.weekRow, styles.weekRowLast] : styles.weekRow,
      },
      week.map((cell, dayIdx) => {
        const dateKey = cell.date.toLocaleDateString('en-CA', { timeZone: timezone });
        const dayEvents = cell.isCurrentMonth ? (eventsByDay.get(dateKey) ?? []) : [];
        const isWeekend = dayIdx === 0 || dayIdx === 6;

        let dayNumberStyle: StyleValue | StyleValue[] = styles.dayNumber;
        if (!cell.isCurrentMonth) {
          dayNumberStyle = [styles.dayNumber, styles.dayNumberMuted];
        } else if (isWeekend) {
          dayNumberStyle = [styles.dayNumber, styles.dayNumberWeekend];
        }

        const cellStyleParts: StyleValue[] = [styles.dayCell];
        if (dayIdx === 6) cellStyleParts.push(styles.dayCellLast);
        if (!cell.isCurrentMonth) cellStyleParts.push(styles.dayCellMuted);

        const visibleEvents = dayEvents.slice(0, MAX_EVENTS_PER_DAY);
        const hiddenCount = dayEvents.length - visibleEvents.length;

        const children: React.ReactNode[] = [
          h(Text, { key: 'day', style: dayNumberStyle }, String(cell.day)),
          ...visibleEvents.map((ev, evIdx) => {
            const color = eventColor(ev.eventType);
            const meta = eventMetaLine(ev);
            return h(
              View,
              {
                key: `ev-${evIdx}`,
                style: [
                  styles.eventPill,
                  { backgroundColor: color.bg, borderLeftColor: color.accent },
                ],
              },
              h(
                Text,
                { key: 'title', style: [styles.eventTitleLine, { color: color.text }] },
                eventLabel(ev, timezone, locale),
              ),
              meta
                ? h(
                    Text,
                    { key: 'meta', style: [styles.eventMetaLine, { color: color.text }] },
                    meta,
                  )
                : null,
            );
          }),
        ];

        if (hiddenCount > 0) {
          children.push(
            h(
              Text,
              { key: 'more', style: styles.moreEvents },
              locale === 'pt-BR' ? `+${hiddenCount} mais` : `+${hiddenCount} more`,
            ),
          );
        }

        return h(View, { key: `c-${weekIdx}-${dayIdx}`, style: cellStyleParts }, children);
      }),
    );
  });

  return h(View, { style: styles.calendarGrid }, headerRow, ...rows);
}

function MonthPage(props: {
  data: MonthData;
  locale: ExportLocale;
  timezone: string;
  eventsByDate: Map<string, CalendarEvent[]>;
  showMiniCalendars: boolean;
}) {
  const { data, locale, timezone, eventsByDate, showMiniCalendars } = props;
  const { year, month, events } = data;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const title = monthName(year, month, locale);

  const sidebar = showMiniCalendars
    ? h(
        View,
        { style: styles.sidebar },
        h(MiniCalendar, {
          year: prev.year,
          month: prev.month,
          locale,
          eventsByDate,
          timezone,
        }),
        h(MiniCalendar, {
          year,
          month,
          locale,
          highlight: true,
          eventsByDate,
          timezone,
        }),
        h(MiniCalendar, {
          year: next.year,
          month: next.month,
          locale,
          eventsByDate,
          timezone,
        }),
      )
    : null;

  return h(
    Page,
    { size: 'A4', orientation: 'landscape', style: styles.page },
    h(
      View,
      { style: styles.body },
      sidebar,
      h(
        View,
        { style: styles.mainArea },
        h(
          View,
          { style: styles.header },
          h(Text, { style: styles.headerTitle }, title),
          h(Text, { style: styles.headerYear }, String(year)),
        ),
        h(MainCalendar, { year, month, events, locale, timezone }),
      ),
    ),
  );
}

export interface RenderOptions {
  showMiniCalendars?: boolean;
}

export async function renderCalendarPdf(
  monthsData: MonthData[],
  locale: ExportLocale,
  timezone: string,
  allEvents?: CalendarEvent[],
  options?: RenderOptions,
): Promise<Buffer> {
  const showMiniCalendars = options?.showMiniCalendars ?? true;
  // Build a date-keyed map of events for mini-calendar indicators.
  // Falls back to events embedded in monthsData when allEvents isn't provided.
  const eventsByDate = new Map<string, CalendarEvent[]>();
  const sourceEvents = allEvents ?? monthsData.flatMap((m) => m.events);
  sourceEvents.forEach((ev) => {
    const key = ev.startAt.toLocaleDateString('en-CA', { timeZone: timezone });
    const list = eventsByDate.get(key) ?? [];
    list.push(ev);
    eventsByDate.set(key, list);
  });

  const pages = monthsData.map((data, idx) =>
    h(MonthPage, { key: `pg-${idx}`, data, locale, timezone, eventsByDate, showMiniCalendars }),
  );
  const doc = h(Document, null, ...pages);
  return renderToBuffer(doc);
}
