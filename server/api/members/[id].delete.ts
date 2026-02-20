export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Member id is required' });
  }

  await prisma.memberDepartment.deleteMany({ where: { memberId: id } });
  await prisma.member.delete({ where: { id } });

  return { success: true };
});
