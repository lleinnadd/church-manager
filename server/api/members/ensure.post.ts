import { MemberStatus } from '@prisma/client';
import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body?.clerkUserId) {
    throw createError({ statusCode: 400, statusMessage: 'clerkUserId is required' });
  }

  const existing = await prisma.member.findUnique({ where: { clerkUserId: body.clerkUserId } });
  if (existing) {
    const desiredName = body.name || existing.name || 'Novo membro';

    // Keep Clerk-managed member aligned with Clerk data (name + active status)
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

  const member = await prisma.member.create({
    data: {
      name: body.name || 'Novo membro',
      congregationId,
      status: MemberStatus.ACTIVE,
      clerkUserId: body.clerkUserId,
    },
  });

  return member;
});
