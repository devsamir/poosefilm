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
});
