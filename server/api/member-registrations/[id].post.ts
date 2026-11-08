import { PermissionAction, Prisma } from '@prisma/client';
import { z } from 'zod';
import { createMemberRegistrationSchema } from '#shared/validation/member';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const schema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('RETURN'),
      updatedAt: z.string().datetime(),
      reason: z.string().trim().min(1),
      expiresAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      action: z.literal('APPROVE'),
      updatedAt: z.string().datetime(),
      memberUpdatedAt: z.string().datetime().nullable(),
      congregationId: z.string().regex(/^[a-f\d]{24}$/i),
      submission: createMemberRegistrationSchema(),
    })
    .strict(),
]);
export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext;
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid review' });
  const body = parsed.data;
  const id = getRouterParam(event, 'id');
  if (!id || !/^[a-f\d]{24}$/i.test(id)) throw createError({ statusCode: 404 });
  return prisma
    .$transaction(async (tx) => {
      const request = await tx.memberRegistration.findUnique({ where: { id } });
      if (!request) throw createError({ statusCode: 404 });
      assertPermission(
        rbac,
        'members',
        request.memberId ? PermissionAction.UPDATE : PermissionAction.CREATE,
      );
      assertCongregationAccess(rbac, 'members', request.congregationId);
      if (request.status !== 'PENDING' || request.updatedAt.toISOString() !== body.updatedAt) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Submission changed. Reload before reviewing.',
        });
      }
      const now = new Date();
      const decision = {
        action: body.action,
        at: now.toISOString(),
        by: rbac.clerkUserId,
        submission: request.submission,
        photoUrl: request.photoUrl,
        photoBlobPath: request.photoBlobPath,
        ...(body.action === 'RETURN'
          ? { reason: body.reason }
          : { approvedSubmission: body.submission, congregationId: body.congregationId }),
      } as Prisma.InputJsonObject;
      const member = request.memberId
        ? await tx.member.findUnique({ where: { id: request.memberId } })
        : null;
      if (request.memberId && !member)
        throw createError({ statusCode: 404, statusMessage: 'Member no longer exists' });
      if (member) assertCongregationAccess(rbac, 'members', member.congregationId);
      if (body.action === 'RETURN') {
        await tx.memberRegistration.update({
          where: { id, updatedAt: request.updatedAt },
          data: {
            status: 'OPEN',
            expiresAt: registrationExpiration(body.expiresAt),
            decisions: { push: decision },
            ...(request.photoBlobPath
              ? { retainedPhotoBlobPaths: { push: request.photoBlobPath } }
              : {}),
          },
        });
        return { success: true };
      }
      assertCongregationAccess(rbac, 'members', body.congregationId);
      if (!(await tx.congregation.findUnique({ where: { id: body.congregationId } })))
        throw createError({ statusCode: 404, statusMessage: 'Congregation not found' });
      if (member && member.updatedAt.toISOString() !== body.memberUpdatedAt) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Member changed. Reload before approving.',
        });
      }
      if (member?.clerkUserId && body.submission.name !== member.name)
        throw createError({ statusCode: 400, statusMessage: 'Name is managed by your account' });
      const details = body.submission;
      const data = {
        ...details,
        congregationId: body.congregationId,
        dateOfBirth: new Date(details.dateOfBirth),
        memberSince: details.memberSince ? new Date(details.memberSince) : null,
        convertionDate: details.convertionDate ? new Date(details.convertionDate) : null,
        nationalId: details.nationalId || null,
        fatherName: details.fatherName || null,
        photoUrl: request.photoUrl,
        ...(request.photoBlobPath ? { photoBlobPath: request.photoBlobPath } : {}),
      };
      let memberId = member?.id;
      if (member) {
        await tx.member.update({ where: { id: member.id, updatedAt: member.updatedAt }, data });
      } else {
        const last = await tx.member.findFirst({
          orderBy: { memberNumber: 'desc' },
          select: { memberNumber: true },
        });
        const created = await tx.member.create({
          data: { ...data, memberNumber: (last?.memberNumber ?? 0) + 1 },
        });
        memberId = created.id;
      }
      await tx.memberRegistration.update({
        where: { id, updatedAt: request.updatedAt },
        data: {
          status: 'APPROVED',
          memberId,
          decisions: { push: decision },
          ...(request.photoBlobPath
            ? { retainedPhotoBlobPaths: { push: request.photoBlobPath } }
            : {}),
        },
      });
      return { success: true, memberId };
    })
    .catch((error) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2025', 'P2002'].includes(error.code)
      ) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Record changed. Reload and try again.',
        });
      }
      throw error;
    });
});
