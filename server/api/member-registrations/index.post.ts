import { PermissionAction } from '@prisma/client';
import { z } from 'zod';
import type { UserPermissionContext } from '~~/shared/types/rbac';

const schema = registrationLinkSchema.extend({
  congregationId: z.string().regex(/^[a-f\d]{24}$/i),
});
export default defineEventHandler(async (event) => {
  const rbac = event.context.rbac as UserPermissionContext;
  assertPermission(rbac, 'members', PermissionAction.CREATE);
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid link details' });
  assertCongregationAccess(rbac, 'members', parsed.data.congregationId);
  if (!(await prisma.congregation.findUnique({ where: { id: parsed.data.congregationId } }))) {
    throw createError({ statusCode: 404, statusMessage: 'Congregation not found' });
  }
  const expiresAt = registrationExpiration(parsed.data.expiresAt);
  const { token, tokenHash } = createRegistrationToken();
  await prisma.memberRegistration.create({
    data: {
      tokenHash,
      expiresAt,
      createdBy: rbac.clerkUserId,
      congregationId: parsed.data.congregationId,
      decisions: [],
    },
  });
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { path: `/complete-registration/${token}`, expiresAt: expiresAt.toISOString() };
});
