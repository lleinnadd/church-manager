import prisma from '#server/utils/prisma';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  await prisma.memberDepartment.deleteMany({ where: { departmentId: id } });
  await prisma.department.delete({ where: { id } });

  return { success: true };
});
