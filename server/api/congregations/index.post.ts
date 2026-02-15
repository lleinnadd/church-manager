import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const congregation = await prisma.congregation.create({
    data: {
      name: body.name,
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
