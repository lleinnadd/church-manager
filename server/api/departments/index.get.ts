import prisma from '#server/utils/prisma';

export default defineEventHandler(async () => {
  return prisma.department.aggregateRaw({
    pipeline: [
      { $sort: { name: 1 } },
      {
        $lookup: {
          from: 'department_functions',
          localField: '_id',
          foreignField: 'departmentId',
          as: 'functions',
        },
      },
      {
        $lookup: {
          from: 'member_departments',
          localField: '_id',
          foreignField: 'departmentId',
          as: 'memberships',
        },
      },
      { $addFields: { memberIds: { $setUnion: ['$memberships.memberId', []] } } },
      { $addFields: { _count: { memberships: { $size: '$memberIds' } } } },
      {
        $addFields: {
          id: { $toString: '$_id' },
          functions: {
            $map: {
              input: '$functions',
              as: 'fn',
              in: {
                id: { $toString: '$$fn._id' },
                name: '$$fn.name',
                description: '$$fn.description',
                departmentId: { $toString: '$$fn.departmentId' },
                createdAt: '$$fn.createdAt',
                updatedAt: '$$fn.updatedAt',
              },
            },
          },
        },
      },
      { $project: { _id: 0, memberships: 0, memberIds: 0 } },
    ],
  });
});
