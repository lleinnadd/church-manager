import { CongregationType } from '@prisma/client';
import prisma from '#server/utils/prisma';

const allowedTypes = Object.values(CongregationType);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

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
