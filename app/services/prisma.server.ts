import { PrismaClient } from "@prisma/client";

declare global {
  var __poosefilmPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__poosefilmPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__poosefilmPrisma = prisma;
}
