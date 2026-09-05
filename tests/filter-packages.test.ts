import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("filter package administration", () => {
  it("keeps filter and package administration behind superadmin access", () => {
    const settings = readFileSync(resolve(process.cwd(), "app/routes/admin.settings.tsx"), "utf8");
    expect(settings).toContain("requireSuperadmin");
    expect(settings).toContain("createFilterPackage");
    expect(settings).toContain("FilterPackageEditor");
  });

  it("offers active packages during cashier order creation", () => {
    const cashier = readFileSync(resolve(process.cwd(), "app/routes/admin.cashier.tsx"), "utf8");
    expect(cashier).toContain("getActiveFilterPackages");
    expect(cashier).toContain('name="filterPackageId"');
  });
});
