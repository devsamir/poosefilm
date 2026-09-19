import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("product administration UI", () => {
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

  it("tags each product with its kind and counts only prints in the footer", () => {
    const cashier = source("app/routes/admin.cashier.tsx");
    expect(cashier).toContain("countPrintQuantity");
    expect(cashier).toContain("PRODUCT_KIND_LABELS[product.kind]");
    expect(cashier).toContain("halaman Produk");
  });
});

describe("daily summary counts prints from order items", () => {
  it("aggregates print item quantities of real orders only", () => {
    const reports = source("app/services/reports.server.ts");
    expect(reports).toContain("prisma.orderItem.aggregate");
    expect(reports).toContain("isRealTransaction: true");
    expect(reports).toContain('productKind: "PRINT"');
    expect(reports).not.toContain("_sum: { quantity: true, totalAmount: true }");
  });
});

describe("dedicated master product page", () => {
  it("is superadmin-only and offers search, type, and status filters", () => {
    const page = source("app/routes/admin.products.tsx");
    expect(page).toContain("requireSuperadmin");
    expect(page).toContain("searchProducts");
    expect(page).toContain('name="q"');
    expect(page).toContain('name="type"');
    expect(page).toContain('name="status"');
  });

  it("creates, updates, and toggles products from the table", () => {
    const page = source("app/routes/admin.products.tsx");
    expect(page).toContain('"product-create"');
    expect(page).toContain('"product-update"');
    expect(page).toContain('"product-toggle"');
    expect(page).toContain("ProductEditor");
    expect(page).toContain("+ Tambah product");
  });

  it("is reachable from the superadmin account menu", () => {
    const menu = source("app/components/AccountMenu.tsx");
    expect(menu).toContain("/admin/products");
  });
});

describe("Settings no longer manages products", () => {
  it("keeps the product master on its own page", () => {
    const settings = source("app/routes/admin.settings.tsx");
    expect(settings).toContain("requireSuperadmin");
    expect(settings).not.toContain('data-testid="product-library"');
    expect(settings).not.toContain("ProductEditor");
    expect(settings).not.toContain("products.server");
    expect(settings).not.toContain('"product-toggle"');
  });
});
