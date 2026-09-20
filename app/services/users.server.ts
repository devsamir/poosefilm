import bcrypt from "bcryptjs";

import { prisma } from "~/services/prisma.server";

export type UserInput = {
  name: string;
  email: string;
  password?: string;
  role: "STAFF" | "SUPERADMIN";
};

export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashUserPassword(password: string) {
  if (password.length < 6) throw new Error("Password minimal 6 karakter.");
  return bcrypt.hash(password, 12);
}

export function canDeactivateSuperadmin(input: {
  activeSuperadminCount: number;
  targetIsSuperadmin: boolean;
  nextActive: boolean;
}) {
  return input.nextActive || !input.targetIsSuperadmin || input.activeSuperadminCount > 1;
}

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(input: UserInput) {
  const name = input.name.trim();
  const email = normalizeUserEmail(input.email);
  if (!name || !email || !input.password) throw new Error("Nama, email, dan password wajib diisi.");
  const passwordHash = await hashUserPassword(input.password);

  return prisma.user.create({
    data: { name, email, passwordHash, role: input.role },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
}

export async function updateUser(id: number, input: UserInput) {
  const name = input.name.trim();
  const email = normalizeUserEmail(input.email);
  if (!name || !email) throw new Error("Nama dan email wajib diisi.");
  const passwordHash = input.password ? await hashUserPassword(input.password) : undefined;

  return prisma.user.update({
    where: { id },
    data: { name, email, role: input.role, ...(passwordHash ? { passwordHash } : {}) },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
}

export async function setUserActive(id: number, active: boolean) {
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
  if (!target) throw new Error("User tidak ditemukan.");
  if (!active && target.isActive && target.role === "SUPERADMIN") {
    const activeSuperadminCount = await prisma.user.count({ where: { role: "SUPERADMIN", isActive: true } });
    if (!canDeactivateSuperadmin({ activeSuperadminCount, targetIsSuperadmin: true, nextActive: false })) {
      throw new Error("Superadmin aktif terakhir tidak dapat dinonaktifkan.");
    }
  }
  return prisma.user.update({
    where: { id },
    data: { isActive: active },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
}
