import * as React from 'react';
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

export interface BirthdayMember {
  name: string;
  dayOfMonth: number;
}

export interface BirthdayMonthData {
  year: number;
  month: number;
  members: BirthdayMember[];
}

export type BirthdayExportLocale = 'pt-BR' | 'en';

const h = React.createElement;

const MONTH_NAMES: Record<BirthdayExportLocale, string[]> = {
  'pt-BR': [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

const LABELS: Record<
  BirthdayExportLocale,
  { title: string; day: string; name: string; empty: string }
> = {
  'pt-BR': {
    title: 'Aniversariantes',
    day: 'Dia',
    name: 'Nome',
    empty: 'Nenhum aniversariante neste mês.',
  },
  en: { title: 'Birthdays', day: 'Day', name: 'Name', empty: 'No birthdays this month.' },
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: '#111827',
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 4,
    paddingTop: 10,
    marginBottom: 2,
  },
  tableHeaderDay: {
    width: 50,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableHeaderName: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  rowEven: {
    backgroundColor: '#f9fafb',
  },
  dayCell: {
    width: 50,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#374151',
  },
  nameCell: {
    flex: 1,
    fontSize: 10,
    color: '#1f2937',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 40,
  },
});

function MonthPage({
  data,
  locale,
  congregationName,
}: {
  data: BirthdayMonthData;
  locale: BirthdayExportLocale;
  congregationName: string;
}) {
  const labels = LABELS[locale];
  const monthName = MONTH_NAMES[locale][data.month]!;
  const title = `${labels.title} — ${monthName} ${data.year}`;

  return h(
    Page,
    { size: 'A4', style: styles.page },
    h(
      View,
      { style: styles.header },
      h(Text, { style: styles.headerTitle }, title),
      h(Text, { style: styles.headerSubtitle }, congregationName),
    ),
    data.members.length === 0
      ? h(Text, { style: styles.emptyText }, labels.empty)
      : h(
          View,
          null,
          h(
            View,
            { style: styles.tableHeader },
            h(Text, { style: styles.tableHeaderDay }, labels.day),
            h(Text, { style: styles.tableHeaderName }, labels.name),
          ),
          ...data.members.map((member, idx) => {
            const showDay = idx === 0 || data.members[idx - 1]!.dayOfMonth !== member.dayOfMonth;
            return h(
              View,
              {
                key: `row-${idx}`,
                style: idx % 2 === 1 ? { ...styles.row, ...styles.rowEven } : styles.row,
              },
              h(
                Text,
                { style: styles.dayCell },
                showDay ? String(member.dayOfMonth).padStart(2, '0') : '',
              ),
              h(Text, { style: styles.nameCell }, member.name),
            );
          }),
        ),
  );
}

export async function renderBirthdayPdf(
  monthsData: BirthdayMonthData[],
  locale: BirthdayExportLocale,
  congregationName: string,
): Promise<Buffer> {
  const pages = monthsData.map((data, idx) =>
    h(MonthPage, { key: `pg-${idx}`, data, locale, congregationName }),
  );

  const doc = h(Document, null, ...pages);
  return renderToBuffer(doc);
}
