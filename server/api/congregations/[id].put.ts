import { CongregationType } from '@prisma/client';
import { createCongregationSchema } from '#shared/validation/congregation';

const congregationSchema = createCongregationSchema();

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const parsed = congregationSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const type = body.type ?? CongregationType.HEADQUARTERS;

  const congregation = await prisma.congregation.update({
    where: { id },
    data: {
      name: body.name,
      type,
      since: body.since ? new Date(body.since) : null,
      zipCode: body.zipCode || null,
      addressLinePrimary: body.addressLinePrimary || null,
      addressLineSecondary: body.addressLineSecondary || null,
      district: body.district || null,
      city: body.city || null,
      state: body.state || null,
    },
  });

  return congregation;
});
