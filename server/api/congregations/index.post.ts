import { CongregationType } from '@prisma/client';
import { z } from 'zod';

const allowedTypes = Object.values(CongregationType);
const congregationSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  since: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  addressLinePrimary: z.string().optional().nullable(),
  addressLineSecondary: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
});

export default defineEventHandler(async (event) => {
  const parsed = congregationSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const type = allowedTypes.includes(body.type)
    ? (body.type as CongregationType)
    : CongregationType.HEADQUARTERS;

  const congregation = await prisma.congregation.create({
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
