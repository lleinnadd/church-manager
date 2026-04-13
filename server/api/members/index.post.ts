import { createMemberSchema } from '#shared/validation/member';

const memberSchema = createMemberSchema();

export default defineEventHandler(async (event) => {
  const parsed = memberSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
  }
  const body = parsed.data;

  const { status } = body;

  const departmentsInput = await resolveMemberDepartmentsInput(
    prisma,
    body.departments,
    body.congregationId,
  );

  const memberNumber = await nextMemberNumber();

  const member = await prisma.member.create({
    data: {
      memberNumber,
      name: body.name,
      congregationId: body.congregationId,
      status,
      clerkUserId: null,
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
