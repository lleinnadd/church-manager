import { PermissionAction } from '@prisma/client';
import type { UserPermissionContext } from '~~/shared/types/rbac';

export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext | null;
  assertPermission(rbac, 'members', PermissionAction.UPDATE);
  const id = getRouterParam(event, 'id');
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  }
  const parsed = registrationMemberLinkSchema.safeParse((await readBody(event)) ?? {});
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid expiration' });
  }
  const member = await prisma.member.findUnique({
    where: { id },
    select: { id: true, congregationId: true, updatedAt: true },
  });
  if (!member) throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  assertCongregationAccess(rbac, 'members', member.congregationId);
  const congregationId = parsed.data.congregationId ?? member.congregationId;
  if (!congregationId)
    throw createError({ statusCode: 400, statusMessage: 'Choose a congregation' });
  assertCongregationAccess(rbac, 'members', congregationId);
  if (!(await prisma.congregation.findUnique({ where: { id: congregationId } })))
    throw createError({ statusCode: 404, statusMessage: 'Congregation not found' });

  const now = new Date();
  const expiresAt = registrationExpiration(parsed.data.expiresAt, now);
  const { token, tokenHash } = createRegistrationToken();
  await prisma.$transaction(async (tx) => {
    if (await tx.memberRegistration.findFirst({ where: { memberId: id, status: 'PENDING' } })) {
      throw createError({ statusCode: 409, statusMessage: 'A submission is awaiting review' });
    }
    const result = await tx.member.updateMany({
      where: { id, updatedAt: member.updatedAt },
      data: {
        registrationTokenHash: tokenHash,
        registrationExpiresAt: expiresAt,
        registrationCreatedAt: now,
        registrationCreatedBy: rbac.clerkUserId,
        registrationUsedAt: null,
      },
    });
    if (result.count !== 1)
      throw createError({ statusCode: 409, statusMessage: 'Member changed. Try again.' });
    await tx.memberRegistration.updateMany({
      where: { memberId: id, status: 'OPEN' },
      data: { status: 'SUPERSEDED' },
    });
    await tx.memberRegistration.create({
      data: {
        tokenHash,
        expiresAt,
        createdBy: rbac.clerkUserId,
        memberId: id,
        congregationId,
        memberUpdatedAt: member.updatedAt,
        decisions: [],
      },
    });
  });
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { path: `/complete-registration/${token}`, expiresAt: expiresAt.toISOString() };
});
