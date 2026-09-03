import bcrypt from "bcryptjs";
import { redirect } from "@remix-run/node";

import { prisma } from "~/services/prisma.server";
import { createUserSession, getUserId, requireUserId } from "~/utils/session.server";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "SUPERADMIN" | "STAFF";
  isActive: boolean;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function canAccessSuperadmin(user: Pick<AuthUser, "role" | "isActive">) {
  return user.isActive && user.role === "SUPERADMIN";
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

function toAuthUser(user: {
  id: number;
  name: string;
  email: string;
  role: "SUPERADMIN" | "STAFF";
  isActive: boolean;
}): AuthUser {
  return user;
}

export async function getUserFromSession(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return null;
  return toAuthUser(user);
}

export async function requireUser(request: Request) {
  const user = await getUserFromSession(request);
  if (!user) throw redirect("/login");
  return user;
}

export async function requireSuperadmin(request: Request) {
  const user = await requireUser(request);
  if (!canAccessSuperadmin(user)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email atau password tidak valid." } as const;
  }

  return createUserSession(user.id);
}

export async function getRequiredUserId(request: Request) {
  return requireUserId(request);
}
