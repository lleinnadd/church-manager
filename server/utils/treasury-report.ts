import * as React from 'react';
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';

const h = React.createElement;

export type ReportLocale = 'pt-BR' | 'en';

interface ReportTransaction {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  date: string;
  categoryName: string | null;
}

interface CategorySummaryItem {
  name: string;
  income: number;
  expense: number;
}

export interface MonthlyReportData {
  month: string;
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpense: number;
  transactions: ReportTransaction[];
  categorySummary: CategorySummaryItem[];
  congregationName?: string | null;
}

const COLORS = {
  income: '#16a34a',
  incomeBg: '#dcfce7',
  expense: '#dc2626',
  expenseBg: '#fee2e2',
  headerBg: '#1e293b',
  headerText: '#ffffff',
  altRowBg: '#f8fafc',
  border: '#e2e8f0',
  text: '#1f2937',
  muted: '#64748b',
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: COLORS.text,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: COLORS.headerBg,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 10,
    borderRadius: 4,
    border: `1 solid ${COLORS.border}`,
  },
  summaryLabel: {
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
    color: COLORS.headerBg,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBg,
    color: COLORS.headerText,
    padding: 6,
    borderRadius: 2,
  },
  tableHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: COLORS.headerText,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 5,
    borderBottom: `1 solid ${COLORS.border}`,
  },
  tableRowAlt: {
    backgroundColor: COLORS.altRowBg,
  },
  colDate: { width: '15%' },
  colName: { width: '30%' },
  colCategory: { width: '20%' },
  colType: { width: '15%' },
  colAmount: { width: '20%', textAlign: 'right' },
  catColName: { width: '40%' },
  catColIncome: { width: '30%', textAlign: 'right' },
  catColExpense: { width: '30%', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: COLORS.muted,
  },
});

const labels: Record<ReportLocale, Record<string, string>> = {
  'pt-BR': {
    title: 'Informe Mensal de Tesouraria',
    openingBalance: 'Saldo Inicial',
    closingBalance: 'Saldo Final',
    totalIncome: 'Total Receitas',
    totalExpense: 'Total Despesas',
    transactions: 'Transações',
    categorySummary: 'Resumo por Categoria',
    date: 'Data',
    name: 'Descrição',
    category: 'Categoria',
    type: 'Tipo',
    amount: 'Valor',
    income: 'Receita',
    expense: 'Despesa',
    uncategorized: 'Sem categoria',
    generatedAt: 'Gerado em',
    page: 'Página',
  },
  en: {
    title: 'Monthly Treasury Report',
    openingBalance: 'Opening Balance',
    closingBalance: 'Closing Balance',
    totalIncome: 'Total Income',
    totalExpense: 'Total Expenses',
    transactions: 'Transactions',
    categorySummary: 'Category Summary',
    date: 'Date',
    name: 'Description',
    category: 'Category',
    type: 'Type',
    amount: 'Amount',
    income: 'Income',
    expense: 'Expense',
    uncategorized: 'Uncategorized',
    generatedAt: 'Generated at',
    page: 'Page',
  },
};

function formatCurrency(value: number, locale: ReportLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string, locale: ReportLocale): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatMonthTitle(month: string, locale: ReportLocale): string {
  const [yearStr, monthStr] = month.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

function MonthlyReportDocument({
  data,
  locale,
}: {
  data: MonthlyReportData;
  locale: ReportLocale;
}) {
  const l = labels[locale];

  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Text, { style: styles.title }, l.title),
      h(
        Text,
        { style: styles.subtitle },
        `${formatMonthTitle(data.month, locale)}${data.congregationName ? ` — ${data.congregationName}` : ''}`,
      ),

      h(
        View,
        { style: styles.summaryRow },
        h(
          View,
          { style: styles.summaryCard },
          h(Text, { style: styles.summaryLabel }, l.openingBalance),
          h(
            Text,
            {
              style: {
                ...styles.summaryValue,
                color: data.openingBalance >= 0 ? COLORS.income : COLORS.expense,
              },
            },
            formatCurrency(data.openingBalance, locale),
          ),
        ),
        h(
          View,
          { style: styles.summaryCard },
          h(Text, { style: styles.summaryLabel }, l.totalIncome),
          h(
            Text,
            { style: { ...styles.summaryValue, color: COLORS.income } },
            formatCurrency(data.totalIncome, locale),
          ),
        ),
        h(
          View,
          { style: styles.summaryCard },
          h(Text, { style: styles.summaryLabel }, l.totalExpense),
          h(
            Text,
            { style: { ...styles.summaryValue, color: COLORS.expense } },
            formatCurrency(data.totalExpense, locale),
          ),
        ),
        h(
          View,
          { style: styles.summaryCard },
          h(Text, { style: styles.summaryLabel }, l.closingBalance),
          h(
            Text,
            {
              style: {
                ...styles.summaryValue,
                color: data.closingBalance >= 0 ? COLORS.income : COLORS.expense,
              },
            },
            formatCurrency(data.closingBalance, locale),
          ),
        ),
      ),

      h(Text, { style: styles.sectionTitle }, l.transactions),
      h(
        View,
        { style: styles.tableHeader },
        h(Text, { style: { ...styles.tableHeaderText, ...styles.colDate } }, l.date),
        h(Text, { style: { ...styles.tableHeaderText, ...styles.colName } }, l.name),
        h(Text, { style: { ...styles.tableHeaderText, ...styles.colCategory } }, l.category),
        h(Text, { style: { ...styles.tableHeaderText, ...styles.colType } }, l.type),
        h(Text, { style: { ...styles.tableHeaderText, ...styles.colAmount } }, l.amount),
      ),
      ...data.transactions.map((tx, index) =>
        h(
          View,
          {
            key: `tx-${index}`,
            style: {
              ...styles.tableRow,
              ...(index % 2 === 1 ? styles.tableRowAlt : {}),
            },
          },
          h(Text, { style: styles.colDate }, formatDate(tx.date, locale)),
          h(Text, { style: styles.colName }, tx.name),
          h(Text, { style: styles.colCategory }, tx.categoryName ?? l.uncategorized),
          h(
            Text,
            {
              style: {
                ...styles.colType,
                color: tx.type === 'INCOME' ? COLORS.income : COLORS.expense,
              },
            },
            tx.type === 'INCOME' ? l.income : l.expense,
          ),
          h(
            Text,
            {
              style: {
                ...styles.colAmount,
                color: tx.type === 'INCOME' ? COLORS.income : COLORS.expense,
              },
            },
            `${tx.type === 'EXPENSE' ? '-' : '+'}${formatCurrency(tx.amount, locale)}`,
          ),
        ),
      ),

      data.categorySummary.length > 0
        ? h(
            View,
            null,
            h(Text, { style: styles.sectionTitle }, l.categorySummary),
            h(
              View,
              { style: styles.tableHeader },
              h(Text, { style: { ...styles.tableHeaderText, ...styles.catColName } }, l.category),
              h(Text, { style: { ...styles.tableHeaderText, ...styles.catColIncome } }, l.income),
              h(Text, { style: { ...styles.tableHeaderText, ...styles.catColExpense } }, l.expense),
            ),
            ...data.categorySummary.map((cat, index) =>
              h(
                View,
                {
                  key: `cat-${index}`,
                  style: {
                    ...styles.tableRow,
                    ...(index % 2 === 1 ? styles.tableRowAlt : {}),
                  },
                },
                h(Text, { style: styles.catColName }, cat.name),
                h(
                  Text,
                  { style: { ...styles.catColIncome, color: COLORS.income } },
                  formatCurrency(cat.income, locale),
                ),
                h(
                  Text,
                  { style: { ...styles.catColExpense, color: COLORS.expense } },
                  formatCurrency(cat.expense, locale),
                ),
              ),
            ),
          )
        : null,

      h(
        View,
        { style: styles.footer, fixed: true },
        h(
          Text,
          null,
          `${l.generatedAt} ${new Intl.DateTimeFormat(locale, {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'America/Sao_Paulo',
          }).format(new Date())}`,
        ),
      ),
    ),
  );
}

export async function renderMonthlyReportPdf(
  data: MonthlyReportData,
  locale: ReportLocale = 'pt-BR',
): Promise<Buffer> {
  const element = h(MonthlyReportDocument, { data, locale });
  return renderToBuffer(element as React.ReactElement<DocumentProps>);
}
