import prisma from '#server/utils/prisma';

export default defineEventHandler(async () => {
  return prisma.memberDepartment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      member: { select: { id: true, name: true, congregationId: true } },
      department: true,
      congregation: { select: { id: true, name: true, type: true } },
    },
  });
});
