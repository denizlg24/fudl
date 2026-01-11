import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { dbEnv } from "@repo/env/db";

const adapter = new PrismaPg({
  connectionString: dbEnv.DATABASE_URL,
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (dbEnv.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
