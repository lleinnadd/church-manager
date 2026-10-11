import { memberRegistrationFields } from '../../../../shared/validation/member';

export default defineEventHandler(async (event) => {
  const member = await getRegistrationMember(getRouterParam(event, 'token') ?? '');
  const personalDetails = Object.fromEntries(
    Object.keys(memberRegistrationFields).map((field) => [
      field,
      member[field as keyof typeof memberRegistrationFields],
    ]),
  );
  return {
    member: {
      ...personalDetails,
      photoUrl: member.photoUrl,
      nameLocked: Boolean(member.clerkUserId),
    },
    expiresAt: member.registrationExpiresAt!.toISOString(),
  };
});
