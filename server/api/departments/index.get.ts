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
      {
        $lookup: {
          from: 'department_local_names',
          localField: '_id',
          foreignField: 'departmentId',
          as: 'localNames',
        },
      },
      {
        $lookup: {
          from: 'congregations',
          localField: 'localNames.congregationId',
          foreignField: '_id',
          as: 'localNameCongregations',
        },
      },
      { $addFields: { memberIds: { $setUnion: ['$memberships.memberId', []] } } },
      { $addFields: { _count: { memberships: { $size: '$memberIds' } } } },
      {
        $addFields: {
          id: { $toString: '$_id' },
          functions: {
            $sortArray: {
              input: '$functions',
              sortBy: { sortOrder: 1, name: 1 },
            },
          },
        },
      },
      {
        $addFields: {
          localNames: {
            $map: {
              input: '$localNames',
              as: 'ln',
              in: {
                id: { $toString: '$$ln._id' },
                name: '$$ln.name',
                congregationId: { $toString: '$$ln.congregationId' },
                congregation: {
                  $let: {
                    vars: {
                      match: {
                        $first: {
                          $filter: {
                            input: '$localNameCongregations',
                            as: 'c',
                            cond: { $eq: ['$$c._id', '$$ln.congregationId'] },
                          },
                        },
                      },
                    },
                    in: {
                      id: { $toString: '$$match._id' },
                      name: '$$match.name',
                      type: '$$match.type',
                    },
                  },
                },
              },
            },
          },
          functions: {
            $map: {
              input: '$functions',
              as: 'fn',
              in: {
                id: { $toString: '$$fn._id' },
                name: '$$fn.name',
                description: '$$fn.description',
                scope: '$$fn.scope',
                sortOrder: '$$fn.sortOrder',
                departmentId: { $toString: '$$fn.departmentId' },
                createdAt: '$$fn.createdAt',
                updatedAt: '$$fn.updatedAt',
              },
            },
          },
        },
      },
      { $project: { _id: 0, memberships: 0, memberIds: 0, localNameCongregations: 0 } },
    ],
  });
});
