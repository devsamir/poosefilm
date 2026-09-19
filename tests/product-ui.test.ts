import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("product administration UI", () => {
  it("lets superadmin manage the product master from Settings", () => {
    const settings = source("app/routes/admin.settings.tsx");
    expect(settings).toContain('data-testid="product-library"');
    expect(settings).toContain("createProduct");
    expect(settings).toContain("updateProduct");
    expect(settings).toContain('"product-create"');
    expect(settings).toContain('"product-update"');
    expect(settings).toContain("ProductEditor");
  });

  it("submits the product fields from the editor form", () => {
    const editor = source("app/components/ProductEditor.tsx");
    expect(editor).toContain('name="isActive"');
    expect(editor).toContain('name="price"');
  });
});
