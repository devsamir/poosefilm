import { describe, expect, it } from "vitest";

import { canAccessSuperadmin, normalizeEmail, verifyPassword } from "~/services/auth.server";

describe("authentication policy", () => {
  it("normalizes login email addresses", () => {
    expect(normalizeEmail("  ADMIN@PooseFilm.ID ")).toBe("admin@poosefilm.id");
  });

  it("verifies a bcrypt password hash", async () => {
    await expect(
      verifyPassword("admin", "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid"),
    ).resolves.toBe(false);
  });

  it("allows only active superadmins into protected settings", () => {
    expect(canAccessSuperadmin({ role: "SUPERADMIN", isActive: true })).toBe(true);
    expect(canAccessSuperadmin({ role: "STAFF", isActive: true })).toBe(false);
    expect(canAccessSuperadmin({ role: "SUPERADMIN", isActive: false })).toBe(false);
  });
});
