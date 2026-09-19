import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("product administration UI", () => {
  it("lets superadmin manage the product master from Settings", () => {
    const settings = source("app/routes/admin.settings.tsx");
    expect(settings).toContain("requireSuperadmin");
    expect(settings).toContain('data-testid="product-library"');
    expect(settings).toContain("createProduct");
    expect(settings).toContain("updateProduct");
    expect(settings).toContain('"product-create"');
    expect(settings).toContain('"product-update"');
    expect(settings).toContain("ProductEditor");
  });

  it("toggles a product active or inactive straight from its card", () => {
    const settings = source("app/routes/admin.settings.tsx");
    expect(settings).toContain('"product-toggle"');
    expect(settings).toContain("setProductActive");
    expect(settings).toContain("Nonaktifkan");
    expect(settings).toContain("Aktifkan");
  });

  it("submits the product fields from the editor form", () => {
    const editor = source("app/components/ProductEditor.tsx");
    expect(editor).toContain('name="isActive"');
    expect(editor).toContain('name="price"');
    expect(editor).toContain('name="kind"');
    expect(editor).toContain('name="description"');
  });
});

describe("cashier and receipt use product items", () => {
  it("renders one quantity input per active product", () => {
    const cashier = source("app/routes/admin.cashier.tsx");
    expect(cashier).toContain("listActiveProducts");
    expect(cashier).toContain("name={`qty_${product.id}`}");
    expect(cashier).toContain("parseOrderItemFields");
    expect(cashier).not.toContain('name="quantity"');
  });

  it("lists item lines on the receipt instead of a single print count", () => {
    const receipt = source("app/components/Receipt.tsx");
    expect(receipt).toContain("order.items.map");
    expect(receipt).not.toContain("Jumlah cetak");
  });
});

describe("daily summary counts prints from order items", () => {
  it("aggregates item quantities of real orders only", () => {
    const reports = source("app/services/reports.server.ts");
    expect(reports).toContain("prisma.orderItem.aggregate");
    expect(reports).toContain("isRealTransaction: true");
    expect(reports).not.toContain("_sum: { quantity: true, totalAmount: true }");
  });
});
