import { MemberStatus } from '@prisma/client';
import { z } from 'zod';

const ensureSchema = z.object({
  name: z.string().optional(),
  congregationId: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const auth = (event.context.auth as () => { userId: string | null })();
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const parsed = ensureSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const existing = await prisma.member.findUnique({ where: { clerkUserId } });
  if (existing) {
    const desiredName = body.name || existing.name || 'Novo membro';

    if (existing.name !== desiredName || existing.status !== MemberStatus.ACTIVE) {
      return prisma.member.update({
        where: { id: existing.id },
        data: {
          name: desiredName,
          status: MemberStatus.ACTIVE,
        },
      });
    }

    return existing;
  }

  let congregationId: string | undefined = body.congregationId;

  if (!congregationId) {
    const congregations = await prisma.congregation.findMany({
      select: { id: true },
      orderBy: { name: 'asc' },
      take: 2,
    });

    if (congregations.length === 1) {
      const [onlyCongregation] = congregations;
      congregationId = onlyCongregation?.id;
    }
  }

  if (!congregationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'congregationId is required to create a member',
    });
  }

  const memberNumber = await nextMemberNumber();

  const member = await prisma.member.create({
    data: {
      memberNumber,
      name: body.name || 'Novo membro',
      congregationId,
      status: MemberStatus.ACTIVE,
      clerkUserId,
    },
  });

  return member;
});
