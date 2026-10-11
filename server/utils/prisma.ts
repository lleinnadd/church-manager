import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () =>
  new PrismaClient({
    omit: {
      member: {
        registrationTokenHash: true,
        registrationExpiresAt: true,
        registrationCreatedAt: true,
        registrationCreatedBy: true,
        registrationUsedAt: true,
      },
    },
  });

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export type AppPrismaClient = typeof prisma;

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
