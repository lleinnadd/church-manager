import { TransactionType, PermissionAction } from '@prisma/client';
import { z } from 'zod';
import { renderMonthlyReportPdf, type MonthlyReportData } from '~~/server/utils/treasury-report';
import { getCongregationLeadership } from '~~/server/utils/congregation-leadership';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  congregationId: z.string(),
  locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
});

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury', PermissionAction.EXPORT);

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'month (YYYY-MM) is required' });
  }

  const { month, congregationId, locale } = parsed.data;
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr) - 1;

  const monthStart = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, monthNum + 1, 0, 23, 59, 59, 999));

  const configWhere: Record<string, unknown> = {
    congregationId,
  };

  const config = await prisma.treasuryConfig.findFirst({ where: configWhere });
  const initialBalance = config?.initialBalance ?? 0;
  const initialBalanceDate = config?.initialBalanceDate ?? new Date(0);

  const priorWhere: Record<string, unknown> = {
    date: { gte: initialBalanceDate, lt: monthStart },
    congregationId,
  };

  const priorTransactions = await prisma.transaction.findMany({
    where: priorWhere,
    select: { type: true, amount: true },
  });

  let openingBalance = initialBalance;
  priorTransactions.forEach((tx) => {
    if (tx.type === TransactionType.INCOME) {
      openingBalance += tx.amount;
    } else {
      openingBalance -= tx.amount;
    }
  });

  const transactionWhere: Record<string, unknown> = {
    date: { gte: monthStart, lte: monthEnd },
    congregationId,
  };

  const transactions = await prisma.transaction.findMany({
    where: transactionWhere,
    include: { category: true },
    orderBy: { date: 'asc' },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap = new Map<string, { name: string; income: number; expense: number }>();

  const reportTransactions = transactions.map((tx) => {
    if (tx.type === TransactionType.INCOME) {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }

    const catKey = tx.categoryId ?? '__uncategorized__';
    const catName = tx.category?.name ?? (locale === 'pt-BR' ? 'Sem categoria' : 'Uncategorized');
    const cat = categoryMap.get(catKey) ?? { name: catName, income: 0, expense: 0 };
    if (tx.type === TransactionType.INCOME) {
      cat.income += tx.amount;
    } else {
      cat.expense += tx.amount;
    }
    categoryMap.set(catKey, cat);

    return {
      name: tx.name,
      type: tx.type,
      amount: tx.amount,
      date: tx.date.toISOString(),
      categoryName: tx.category?.name ?? null,
    };
  });

  const closingBalance = openingBalance + totalIncome - totalExpense;

  const congregation = await prisma.congregation.findUnique({
    where: { id: congregationId },
    select: { name: true },
  });
  const congregationName = congregation?.name ?? null;

  const leadership = await getCongregationLeadership(prisma, congregationId);
  const pastorName = leadership?.responsibles?.[0]?.memberName ?? null;

  const reportData: MonthlyReportData = {
    month,
    openingBalance,
    closingBalance,
    totalIncome,
    totalExpense,
    transactions: reportTransactions,
    categorySummary: Array.from(categoryMap.entries()).map(([, data]) => ({
      name: data.name,
      income: data.income,
      expense: data.expense,
    })),
    congregationName,
    pastorName,
  };

  const pdfBuffer = await renderMonthlyReportPdf(reportData, locale);

  const fileName = `informe-tesouraria-${month}.pdf`;

  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': pdfBuffer.byteLength.toString(),
  });

  return pdfBuffer;
});
