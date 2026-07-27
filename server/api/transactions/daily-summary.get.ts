import { TransactionType, PermissionAction } from '@prisma/client';
import { z } from 'zod';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const querySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  congregationId: z.string(),
});

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'treasury', PermissionAction.READ);

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'startDate and endDate are required' });
  }

  const { startDate, endDate, congregationId } = parsed.data;
  assertCongregationAccess(rbac, 'treasury', congregationId);
  const start = new Date(startDate);
  const end = new Date(endDate);

  const configWhere: Record<string, unknown> = {
    congregationId,
  };

  const config = await prisma.treasuryConfig.findFirst({ where: configWhere });
  const initialBalance = config?.initialBalance ?? 0;
  const initialBalanceDate = config?.initialBalanceDate ?? new Date(0);

  const transactionWhere: Record<string, unknown> = {
    date: { gte: start, lte: end },
    congregationId,
  };

  const transactions = await prisma.transaction.findMany({
    where: transactionWhere,
    include: {
      category: true,
      attachments: true,
    },
    orderBy: { date: 'asc' },
  });

  const priorWhere: Record<string, unknown> = {
    date: { gte: initialBalanceDate, lt: start },
    congregationId,
  };

  const priorTransactions = await prisma.transaction.findMany({
    where: priorWhere,
    select: { type: true, amount: true },
  });

  let carryOver = initialBalance;
  priorTransactions.forEach((tx) => {
    if (tx.type === TransactionType.INCOME) {
      carryOver += tx.amount;
    } else {
      carryOver -= tx.amount;
    }
  });

  const dailyMap = new Map<string, typeof transactions>();
  transactions.forEach((tx) => {
    const dayKey = tx.date.toISOString().slice(0, 10);
    const existing = dailyMap.get(dayKey) ?? [];
    existing.push(tx);
    dailyMap.set(dayKey, existing);
  });

  const sortedDays = Array.from(dailyMap.keys()).sort();
  let runningBalance = carryOver;

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
      transactions: dayTransactions,
    };
  });

  return {
    carryOverBalance: carryOver,
    dailySummaries,
  };
});
