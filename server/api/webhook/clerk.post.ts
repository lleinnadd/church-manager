import { MemberStatus } from '@prisma/client';
import { verifyWebhook } from '@clerk/nuxt/webhooks';
import prisma from '#server/utils/prisma';

const mapClerkName = (data: any) => {
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
    const evt = await verifyWebhook(event);
    const eventType = evt.type;
    const clerkUserId = evt.data?.id;

    if (!clerkUserId) {
      console.warn('Webhook received without clerk user id:', eventType);
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
      const result = await prisma.member.updateMany({
        where: { clerkUserId },
        data: { name },
      });

      if (!result.count) {
        console.log('No member found to update for clerk user:', clerkUserId);
      }

      return 'Webhook received';
    }

    console.log(`Ignoring unsupported webhook event: ${eventType}`);
    return 'Webhook received';
  } catch (err) {
    console.error('Error verifying webhook:', err);
    setResponseStatus(event, 400);
    return 'Error verifying webhook';
  }
});
