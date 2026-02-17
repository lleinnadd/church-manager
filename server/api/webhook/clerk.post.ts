import { MemberStatus } from '@prisma/client';
import { verifyWebhook } from '@clerk/nuxt/webhooks';
import { z } from 'zod';
import prisma from '#server/utils/prisma';

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
  try {
    const verified = await verifyWebhook(event);
    const parsed = webhookSchema.safeParse(verified);
    if (!parsed.success) {
      setResponseStatus(event, 400);
      return 'Error verifying webhook';
    }

    const evt = parsed.data;
    const eventType = evt.type;
    const clerkUserId = evt.data?.id;

    if (!clerkUserId) {
      return 'Webhook received';
    }

    if (eventType === 'user.created') {
      const name = mapClerkName(evt.data);

      await prisma.member.upsert({
        where: { clerkUserId },
        update: {
          name,
          status: MemberStatus.ACTIVE,
        },
        create: {
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

    return 'Webhook received';
  } catch (_err) {
    setResponseStatus(event, 400);
    return 'Error verifying webhook';
  }
});
