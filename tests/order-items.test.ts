import { describe, expect, it } from "vitest";

import { calculateOrderTotal, countPrintQuantity, parseOrderItemFields, resolveOrderItems, validateOrderItems } from "~/utils/order-items";

describe("parseOrderItemFields", () => {
  it("reads qty_<productId> fields and skips blank, zero, and unrelated fields", () => {
    const entries: Array<[string, string]> = [["customerName", "Husein"], ["qty_1", "2"], ["qty_2", "0"], ["qty_3", ""], ["qty_4", "5"]];
    expect(parseOrderItemFields(entries)).toEqual([{ productId: 1, quantity: 2 }, { productId: 4, quantity: 5 }]);
  });

  it("keeps invalid quantities so validation can reject them", () => {
    expect(parseOrderItemFields([["qty_1", "-1"], ["qty_2", "1.5"]])).toEqual([{ productId: 1, quantity: -1 }, { productId: 2, quantity: 1.5 }]);
  });
});

describe("validateOrderItems", () => {
  it("accepts distinct products with positive integer quantities", () => {
    const items = [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }];
    expect(validateOrderItems(items)).toEqual(items);
  });

  it("rejects an empty order", () => {
    expect(() => validateOrderItems([])).toThrow("Pilih minimal satu product.");
  });

  it("rejects non-positive or fractional quantities", () => {
    expect(() => validateOrderItems([{ productId: 1, quantity: 0 }])).toThrow("Jumlah product wajib valid.");
    expect(() => validateOrderItems([{ productId: 1, quantity: 1.5 }])).toThrow("Jumlah product wajib valid.");
  });

  it("rejects an invalid product id and duplicate products", () => {
    expect(() => validateOrderItems([{ productId: Number.NaN, quantity: 1 }])).toThrow("Product tidak valid.");
    expect(() => validateOrderItems([{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }])).toThrow("Product tidak boleh duplikat.");
  });
});

describe("resolveOrderItems", () => {
  const products = [
    { id: 1, name: "Strip 2 pose", price: 50000, kind: "PRINT" as const, isActive: true },
    { id: 2, name: "Cabinet", price: 95000, kind: "PRINT" as const, isActive: true },
    { id: 3, name: "Lama", price: 10000, kind: "PRINT" as const, isActive: false },
    { id: 4, name: "Kaos", price: 120000, kind: "MERCH" as const, isActive: true },
  ];

  it("snapshots the current name, kind, and price of each product", () => {
    expect(resolveOrderItems([{ productId: 2, quantity: 3 }], products)).toEqual([{ productId: 2, productName: "Cabinet", productKind: "PRINT", unitPrice: 95000, quantity: 3 }]);
    expect(resolveOrderItems([{ productId: 4, quantity: 1 }], products)).toEqual([{ productId: 4, productName: "Kaos", productKind: "MERCH", unitPrice: 120000, quantity: 1 }]);
  });

  it("rejects a missing or inactive product", () => {
    expect(() => resolveOrderItems([{ productId: 99, quantity: 1 }], products)).toThrow("Product tidak ditemukan atau sudah nonaktif.");
    expect(() => resolveOrderItems([{ productId: 3, quantity: 1 }], products)).toThrow("Product tidak ditemukan atau sudah nonaktif.");
  });
});

describe("countPrintQuantity", () => {
  it("counts only print items", () => {
    const items = [{ productKind: "PRINT" as const, quantity: 3 }, { productKind: "MERCH" as const, quantity: 2 }, { productKind: "PRINT" as const, quantity: 1 }];
    expect(countPrintQuantity(items)).toBe(4);
  });

  it("is zero when every item is merch or there are no items", () => {
    expect(countPrintQuantity([{ productKind: "MERCH" as const, quantity: 5 }])).toBe(0);
    expect(countPrintQuantity([])).toBe(0);
  });
});

describe("calculateOrderTotal", () => {
  const items = [{ unitPrice: 95000, quantity: 3 }, { unitPrice: 50000, quantity: 2 }];

  it("sums every line", () => {
    expect(calculateOrderTotal(items)).toBe(385000);
  });

  it("is zero for a non-real transaction", () => {
    expect(calculateOrderTotal(items, false)).toBe(0);
  });
});
