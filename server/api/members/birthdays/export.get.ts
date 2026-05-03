import { z } from 'zod';
import type { BirthdayMonthData } from '~~/server/utils/birthday-export';

const querySchema = z.object({
  months: z
    .string()
    .transform((value) => value.split(','))
    .pipe(
      z
        .array(z.string().regex(/^\d{4}-\d{2}$/))
        .min(1)
        .max(12),
    ),
  locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
});

export default defineEventHandler(async (event) => {
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query params' });
  }

  const { months: monthStrings, locale } = parsed.data;

  const auth = (event.context.auth as () => { userId: string | null })();
  const clerkUserId = auth?.userId ?? null;

  if (!clerkUserId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const viewerMember = await prisma.member.findUnique({
    where: { clerkUserId },
    select: {
      congregationId: true,
      congregation: { select: { id: true, name: true } },
    },
  });

  if (!viewerMember?.congregationId) {
    throw createError({ statusCode: 404, statusMessage: 'Member congregation not found' });
  }

  const requestedMonths = monthStrings.map((m) => {
    const [yearStr, monthStr] = m.split('-');
    return { year: Number(yearStr), month: Number(monthStr) - 1 };
  });

  const sortedMonths = [...requestedMonths].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
  );

  const members = await prisma.member.findMany({
    where: {
      congregationId: viewerMember.congregationId,
      dateOfBirth: { not: null },
    },
    select: {
      name: true,
      dateOfBirth: true,
    },
    orderBy: { name: 'asc' },
  });

  const monthsData: BirthdayMonthData[] = sortedMonths.map(({ year, month }) => {
    const monthMembers = members
      .filter((m) => {
        const dob = m.dateOfBirth!;
        return dob.getUTCMonth() === month;
      })
      .map((m) => ({
        name: m.name,
        dayOfMonth: m.dateOfBirth!.getUTCDate(),
      }))
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

    return { year, month, members: monthMembers };
  });

  const congregationName = viewerMember.congregation?.name ?? '';

  const pdfBuffer = await renderBirthdayPdf(monthsData, locale, congregationName);

  const fileName =
    monthStrings.length === 1
      ? `aniversariantes-${monthStrings[0]}.pdf`
      : `aniversariantes-${monthStrings[0]}-a-${monthStrings[monthStrings.length - 1]}.pdf`;

  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-cache',
  });

  return pdfBuffer;
});
