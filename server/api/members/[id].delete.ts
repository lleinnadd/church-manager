export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  await prisma.memberDepartment.deleteMany({ where: { memberId: id } });
  await prisma.member.delete({ where: { id } });

  return { success: true };
});
