export async function nextMemberNumber(): Promise<number> {
  const last = await prisma.member.findFirst({
    orderBy: { memberNumber: 'desc' },
    select: { memberNumber: true },
  });

  return (last?.memberNumber ?? 0) + 1;
}
