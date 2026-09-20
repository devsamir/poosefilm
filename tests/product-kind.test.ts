import { describe, expect, it } from "vitest";

import { PRODUCT_KINDS, PRODUCT_KIND_LABELS, PRODUCT_KIND_PILL_CLASSES, isProductKind } from "~/utils/product-kind";

describe("product kind", () => {
  it("knows the two kinds with a label and pill style for each", () => {
    expect(PRODUCT_KINDS).toEqual(["PRINT", "MERCH"]);
    expect(PRODUCT_KIND_LABELS).toEqual({ PRINT: "Cetak", MERCH: "Merch" });
    expect(Object.keys(PRODUCT_KIND_PILL_CLASSES)).toEqual(["PRINT", "MERCH"]);
  });

  it("recognises only valid kinds", () => {
    expect(isProductKind("PRINT")).toBe(true);
    expect(isProductKind("MERCH")).toBe(true);
    expect(isProductKind("ALL")).toBe(false);
    expect(isProductKind("print")).toBe(false);
    expect(isProductKind("")).toBe(false);
    expect(isProductKind(undefined)).toBe(false);
  });
});
