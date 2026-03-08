export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Member id is required' });
  }

  const member = await prisma.member.findUnique({
    where: { id },
    select: { photoBlobPath: true },
  });

  await prisma.memberDepartment.deleteMany({ where: { memberId: id } });
  await prisma.member.delete({ where: { id } });

  if (member?.photoBlobPath) {
    await safeDeleteBlob(member.photoBlobPath);
  }

  return { success: true };
});
