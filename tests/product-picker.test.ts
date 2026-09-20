import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("SettingsModal options used by the picker", () => {
  it("has an optional eyebrow that defaults to the old text and a data-autofocus hook", () => {
    const modal = source("app/components/SettingsModal.tsx");
    expect(modal).toContain('eyebrow = "Poosefilm settings"');
    expect(modal).toContain("{eyebrow}");
    expect(modal).toContain("[data-autofocus]");
  });
});

describe("product picker popup", () => {
  it("searches, filters by kind, adds on click, and closes with Selesai", () => {
    const picker = source("app/components/ProductPickerModal.tsx");
    expect(picker).toContain('eyebrow="KASIR"');
    expect(picker).toContain("filterPickerProducts");
    expect(picker).toContain("data-autofocus");
    expect(picker).toContain("onAdd(product.id)");
    expect(picker).toContain("Tidak ada product yang cocok.");
    expect(picker).toContain("Selesai");
  });

  it("never renders a submit button, so it cannot submit a surrounding form", () => {
    const picker = source("app/components/ProductPickerModal.tsx");
    expect(picker).not.toContain('type="submit"');
  });
});
