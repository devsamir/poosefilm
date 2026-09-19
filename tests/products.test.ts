import { describe, expect, it } from "vitest";

import { normalizeProductInput, validateProductPrice } from "~/services/products.server";

describe("product validation", () => {
  it("accepts only positive integer prices", () => {
    expect(validateProductPrice("95000")).toBe(95000);
    expect(() => validateProductPrice("0")).toThrow();
    expect(() => validateProductPrice("95000.5")).toThrow();
    expect(() => validateProductPrice("")).toThrow();
  });

  it("trims the name, converts the price, and defaults to active", () => {
    expect(normalizeProductInput({ name: "  Strip 2 pose ", price: "50000" })).toEqual({ name: "Strip 2 pose", price: 50000, isActive: true });
    expect(normalizeProductInput({ name: "Lama", price: "10000", isActive: false })).toEqual({ name: "Lama", price: 10000, isActive: false });
  });

  it("requires a name", () => {
    expect(() => normalizeProductInput({ name: "   ", price: "50000" })).toThrow("Nama wajib diisi.");
  });
});
