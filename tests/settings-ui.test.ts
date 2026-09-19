import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("settings UI", () => {
  it("uses compact libraries with modal editors instead of inline editor dumps", () => {
    const source = readFileSync(resolve(process.cwd(), "app/routes/admin.settings.tsx"), "utf8");
    expect(source).toContain("SettingsModal");
    expect(source).toContain('data-testid="filter-library"');
    expect(source).toContain('data-testid="package-library"');
    expect(source).not.toContain("<details");
    expect(source).not.toContain("Harga per cetak");
    expect(source).not.toContain("updatePricePerPrint");
  });
});
