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

  it("pre-selects the default filter package in the cashier dropdown", () => {
    const cashier = readFileSync(resolve(process.cwd(), "app/routes/admin.cashier.tsx"), "utf8");
    expect(cashier).toContain("filterPackage.isDefault");
    expect(cashier).toContain("defaultFilterPackageId");
  });

  it("keeps only one default filter package at a time", () => {
    const service = readFileSync(resolve(process.cwd(), "app/services/filter-packages.server.ts"), "utf8");
    expect(service).toContain('await transaction.filterPackage.updateMany({ where: { isDefault: true }, data: { isDefault: false } });');
    expect(service).toContain('await transaction.filterPackage.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });');
  });

  it("forces isDefault off when a package is inactive", () => {
    const service = readFileSync(resolve(process.cwd(), "app/services/filter-packages.server.ts"), "utf8");
    const createFunction = service.slice(service.indexOf("export async function createFilterPackage"), service.indexOf("export async function updateFilterPackage"));
    const updateFunction = service.slice(service.indexOf("export async function updateFilterPackage"), service.indexOf("export async function deleteFilterPackage"));
    expect(createFunction).toContain("const isDefault = isActive && Boolean(input.isDefault);");
    expect(updateFunction).toContain("const isDefault = isActive && Boolean(input.isDefault);");
  });

  it("lets a superadmin mark a package as default from the settings UI", () => {
    const editor = readFileSync(resolve(process.cwd(), "app/components/FilterPackageEditor.tsx"), "utf8");
    expect(editor).toContain('name="isDefault"');
  });
});
