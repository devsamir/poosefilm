import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("multi-product schema", () => {
  it("defines products and per-order items with price snapshots", () => {
    expect(schema).toContain("model Product");
    expect(schema).toContain("model OrderItem");
    expect(schema).toContain("productName");
    expect(schema).toContain("@@unique([orderId, productId])");
  });

  it("no longer stores a single price or quantity on the order or settings", () => {
    const orderModel = schema.match(/model Order \{[\s\S]*?\n\}/)?.[0] ?? "";
    const settingModel = schema.match(/model AppSetting \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(orderModel).toContain("model Order");
    expect(orderModel).not.toContain("unitPrice");
    expect(orderModel).not.toMatch(/\n\s+quantity\s/);
    expect(settingModel).not.toContain("pricePerPrint");
  });

  it("flags products as print or merch and snapshots the kind on order items", () => {
    const productModel = schema.match(/model Product \{[\s\S]*?\n\}/)?.[0] ?? "";
    const itemModel = schema.match(/model OrderItem \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(schema).toContain("enum ProductKind");
    expect(productModel).toContain("kind");
    expect(productModel).toContain("description");
    expect(itemModel).toMatch(/productKind\s+ProductKind\s+@map\("product_kind"\)\s*\n/);
  });
});
