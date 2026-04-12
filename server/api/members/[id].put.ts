import { MemberStatus } from '@prisma/client';
import { createMemberSchema } from '#shared/validation/member';

const memberSchema = createMemberSchema();

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const parsed = memberSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const existing = await prisma.member.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  }

  if (existing.photoBlobPath && existing.photoBlobPath !== body.photoBlobPath) {
    await safeDeleteBlob(existing.photoBlobPath);
  }

  const isClerkManaged = Boolean(existing.clerkUserId);

  const status = isClerkManaged ? MemberStatus.ACTIVE : body.status;

  const departmentsInput = await resolveMemberDepartmentsInput(
    prisma,
    body.departments,
    body.congregationId,
  );

  const member = await prisma.member.update({
    where: { id },
    data: {
      name: isClerkManaged ? undefined : body.name,
      congregationId: body.congregationId,
      status,
      clerkUserId: undefined,
      dateOfBirth: new Date(body.dateOfBirth),
      memberSince: new Date(body.memberSince),
      convertionDate: new Date(body.convertionDate),
      ssn: body.ssn,
      nationalId: body.nationalId,
      maritalStatus: body.maritalStatus,
      addressLinePrimary: body.addressLinePrimary,
      district: body.district,
      motherName: body.motherName,
      fatherName: body.fatherName,
      naturality: body.naturality,
      nationality: body.nationality,
      phonePrimary: body.phonePrimary,
      phoneSecondary: body.phoneSecondary,
      photoUrl: body.photoUrl ?? null,
      photoBlobPath: body.photoBlobPath ?? null,
      observations: body.observations,
      departments: {
        deleteMany: {},
        create: departmentsInput,
      },
    },
    include: {
      departments: {
        include: {
          department: true,
          function: true,
          congregation: { select: { id: true, name: true, type: true } },
        },
      },
      congregation: { select: { id: true, name: true, type: true } },
    },
  });

  return member;
});
