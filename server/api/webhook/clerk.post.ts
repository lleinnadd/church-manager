import { MemberStatus } from '@prisma/client';
import { verifyWebhook } from '@clerk/nuxt/webhooks';
import { z } from 'zod';
import { deleteLocalMember } from '../../utils/member-deletion';

const clerkUserSchema = z
  .object({
    id: z.string().optional(),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
    email_addresses: z
      .array(z.object({ email_address: z.string().optional().nullable() }))
      .optional(),
  })
  .passthrough();

const webhookSchema = z.object({
  type: z.string(),
  data: clerkUserSchema.optional(),
});

type ClerkUserPayload = z.infer<typeof clerkUserSchema>;

const mapClerkName = (data: ClerkUserPayload | undefined) => {
  const firstName = typeof data?.first_name === 'string' ? data.first_name : data?.firstName;
  const lastName = typeof data?.last_name === 'string' ? data.last_name : data?.lastName;
  const combined = `${firstName ?? ''} ${lastName ?? ''}`.trim();

  if (combined) return combined;
  if (typeof data?.username === 'string' && data.username.trim()) return data.username.trim();
  const primaryEmail = Array.isArray(data?.email_addresses)
    ? data.email_addresses[0]?.email_address
    : undefined;
  if (typeof primaryEmail === 'string' && primaryEmail.trim()) return primaryEmail.trim();

  return 'Novo membro';
};

export default defineEventHandler(async (event) => {
  let verified: unknown;
  try {
    verified = await verifyWebhook(event);
  } catch (_err) {
    setResponseStatus(event, 400);
    return 'Error verifying webhook';
  }

  const parsed = webhookSchema.safeParse(verified);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return 'Invalid webhook payload';
  }

  const evt = parsed.data;
  const eventType = evt.type;
  const clerkUserId = evt.data?.id;

  if (!clerkUserId?.trim()) {
    if (eventType === 'user.deleted') {
      setResponseStatus(event, 400);
      return 'Invalid webhook payload';
    }
    return 'Webhook received';
  }

  try {
    if (eventType === 'user.created') {
      const name = mapClerkName(evt.data);

      const memberNumber = await nextMemberNumber();

      await prisma.member.upsert({
        where: { clerkUserId },
        update: {
          name,
          status: MemberStatus.ACTIVE,
        },
        create: {
          memberNumber,
          name,
          status: MemberStatus.ACTIVE,
          clerkUserId,
          congregationId: null,
        },
      });

      return 'Webhook received';
    }

    if (eventType === 'user.updated') {
      const name = mapClerkName(evt.data);
      await prisma.member.updateMany({
        where: { clerkUserId },
        data: { name },
      });

      return 'Webhook received';
    }

    if (eventType === 'user.deleted') {
      await deleteLocalMember({ clerkUserId });
      return 'Webhook received';
    }

    return 'Webhook received';
  } catch (error) {
    // Keep failed deliveries visible for diagnosis and replay.
    // eslint-disable-next-line no-console
    console.error('Clerk webhook processing failed', { eventType, clerkUserId, error });
    setResponseStatus(event, 500);
    return 'Error processing webhook';
  }
});
