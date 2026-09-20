import { describe, expect, it } from "vitest";

import { normalizeProductInput, validateProductPrice } from "~/services/products.server";

describe("product validation", () => {
  it("accepts only positive integer prices", () => {
    expect(validateProductPrice("95000")).toBe(95000);
    expect(() => validateProductPrice("0")).toThrow();
    expect(() => validateProductPrice("95000.5")).toThrow();
    expect(() => validateProductPrice("")).toThrow();
  });

  it("trims the name and description, converts the price, and defaults to active", () => {
    expect(normalizeProductInput({ name: "  Strip 2 pose ", price: "50000", kind: "PRINT", description: "  Dua pose  " })).toEqual({ name: "Strip 2 pose", price: 50000, kind: "PRINT", description: "Dua pose", isActive: true });
    expect(normalizeProductInput({ name: "Kaos", price: "120000", kind: "MERCH", isActive: false })).toEqual({ name: "Kaos", price: 120000, kind: "MERCH", description: null, isActive: false });
  });

  it("turns a blank description into null", () => {
    expect(normalizeProductInput({ name: "Kaos", price: "120000", kind: "MERCH", description: "   " }).description).toBeNull();
  });

  it("requires a name", () => {
    expect(() => normalizeProductInput({ name: "   ", price: "50000", kind: "PRINT" })).toThrow("Nama wajib diisi.");
  });

  it("rejects an unknown or missing kind", () => {
    expect(() => normalizeProductInput({ name: "X", price: "1000", kind: "SERVICE" })).toThrow("Tipe product tidak valid.");
    expect(() => normalizeProductInput({ name: "X", price: "1000", kind: "" })).toThrow("Tipe product tidak valid.");
  });

  it("limits the description to 255 characters", () => {
    expect(normalizeProductInput({ name: "X", price: "1000", kind: "PRINT", description: "a".repeat(255) }).description).toHaveLength(255);
    expect(() => normalizeProductInput({ name: "X", price: "1000", kind: "PRINT", description: "a".repeat(256) })).toThrow("Keterangan maksimal 255 karakter.");
  });
});
