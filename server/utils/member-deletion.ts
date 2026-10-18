import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { safeDeleteBlob } from './member-photo';

type MemberDeletionTarget = { id: string } | { clerkUserId: string };

export async function deleteLocalMember(where: MemberDeletionTarget): Promise<void> {
  let photoBlobPath: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      // A conflict must roll back before the next attempt starts.
      // eslint-disable-next-line no-await-in-loop
      photoBlobPath = await prisma.$transaction(async (tx) => {
        const member = await tx.member.findUnique({
          where,
          select: { id: true, photoBlobPath: true },
        });

        if (!member) return null;

        await tx.memberDepartment.deleteMany({ where: { memberId: member.id } });
        await tx.member.delete({ where: { id: member.id } });
        return member.photoBlobPath;
      });

      break;
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      if (!retryable || attempt === 4) throw error;
    }
  }

  if (photoBlobPath) await safeDeleteBlob(photoBlobPath);
}
