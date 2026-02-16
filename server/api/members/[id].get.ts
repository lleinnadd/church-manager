import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      congregation: { select: { id: true, name: true, type: true } },
      departments: {
        include: {
          department: true,
          congregation: { select: { id: true, name: true, type: true } },
          function: true,
        },
      },
    },
  });

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  }

  return member;
});
