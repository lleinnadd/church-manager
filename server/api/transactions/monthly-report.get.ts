import { TransactionType } from '@prisma/client';
import { z } from 'zod';

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  congregationId: z.string(),
});

export default defineEventHandler(async (event) => {
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'month (YYYY-MM) is required' });
  }

  const { month, congregationId } = parsed.data;
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
    include: {
      category: true,
      congregation: { select: { id: true, name: true, type: true } },
      attachments: true,
    },
    orderBy: { date: 'asc' },
  });

  let totalIncome = 0;
  let totalExpense = 0;

  const categoryMap = new Map<string, { name: string; income: number; expense: number }>();

  transactions.forEach((tx) => {
    if (tx.type === TransactionType.INCOME) {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }

    const catKey = tx.categoryId ?? '__uncategorized__';
    const catName = tx.category?.name ?? 'Sem categoria';
    const cat = categoryMap.get(catKey) ?? { name: catName, income: 0, expense: 0 };
    if (tx.type === TransactionType.INCOME) {
      cat.income += tx.amount;
    } else {
      cat.expense += tx.amount;
    }
    categoryMap.set(catKey, cat);
  });

  const closingBalance = openingBalance + totalIncome - totalExpense;

  const dailyMap = new Map<string, typeof transactions>();
  transactions.forEach((tx) => {
    const dayKey = tx.date.toISOString().slice(0, 10);
    const existing = dailyMap.get(dayKey) ?? [];
    existing.push(tx);
    dailyMap.set(dayKey, existing);
  });

  const sortedDays = Array.from(dailyMap.keys()).sort();
  let runningBalance = openingBalance;

  const dailySummaries = sortedDays.map((day) => {
    const dayTransactions = dailyMap.get(day) ?? [];
    let dayIncome = 0;
    let dayExpense = 0;

    dayTransactions.forEach((tx) => {
      if (tx.type === TransactionType.INCOME) {
        dayIncome += tx.amount;
      } else {
        dayExpense += tx.amount;
      }
    });

    runningBalance += dayIncome - dayExpense;

    return {
      date: day,
      income: dayIncome,
      expense: dayExpense,
      balance: runningBalance,
    };
  });

  const categorySummary = Array.from(categoryMap.entries()).map(([id, data]) => ({
    categoryId: id === '__uncategorized__' ? null : id,
    name: data.name,
    income: data.income,
    expense: data.expense,
  }));

  return {
    month,
    openingBalance,
    closingBalance,
    totalIncome,
    totalExpense,
    transactions,
    dailySummaries,
    categorySummary,
  };
});
