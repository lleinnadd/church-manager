export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Department id is required' });
  }

  await prisma.memberDepartment.deleteMany({ where: { departmentId: id } });
  await prisma.departmentLocalName.deleteMany({ where: { departmentId: id } });
  await prisma.departmentFunction.deleteMany({ where: { departmentId: id } });
  await prisma.department.delete({ where: { id } });

  return { success: true };
});
