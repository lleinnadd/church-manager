export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Congregation id is required' });
  }

  await prisma.departmentLocalName.deleteMany({ where: { congregationId: id } });
  await prisma.memberDepartment.deleteMany({ where: { congregationId: id } });
  await prisma.member.updateMany({
    where: { congregationId: id },
    data: { congregationId: null },
  });

  await prisma.congregation.delete({
    where: { id },
  });

  return { success: true };
});
