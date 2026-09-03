import { describe, expect, it } from "vitest";

import {
  canDeactivateSuperadmin,
  hashUserPassword,
  normalizeUserEmail,
  validatePricePerPrint,
} from "~/services/users.server";

describe("settings and user policies", () => {
  it("accepts only positive integer prices", () => {
    expect(validatePricePerPrint("95000")).toBe(95000);
    expect(() => validatePricePerPrint("0")).toThrow();
    expect(() => validatePricePerPrint("95000.5")).toThrow();
  });

  it("normalizes emails and hashes passwords", async () => {
    expect(normalizeUserEmail(" Staff@PooseFilm.ID ")).toBe("staff@poosefilm.id");
    const hash = await hashUserPassword("secret");
    expect(hash).not.toBe("secret");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("protects the last active superadmin", () => {
    expect(canDeactivateSuperadmin({ activeSuperadminCount: 1, targetIsSuperadmin: true, nextActive: false })).toBe(false);
    expect(canDeactivateSuperadmin({ activeSuperadminCount: 2, targetIsSuperadmin: true, nextActive: false })).toBe(true);
    expect(canDeactivateSuperadmin({ activeSuperadminCount: 1, targetIsSuperadmin: false, nextActive: false })).toBe(true);
  });
});
