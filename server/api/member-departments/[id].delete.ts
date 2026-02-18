export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  await prisma.memberDepartment.delete({ where: { id } });

  return { success: true };
});
