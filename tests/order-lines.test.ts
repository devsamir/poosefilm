import { describe, expect, it } from "vitest";

import { addOrderLine, filterPickerProducts, removeOrderLine, setOrderLineQuantity } from "~/utils/order-lines";

describe("addOrderLine", () => {
  it("appends a new product with quantity 1", () => {
    expect(addOrderLine([], 5)).toEqual([{ productId: 5, quantity: 1 }]);
    expect(addOrderLine([{ productId: 1, quantity: 2 }], 5)).toEqual([{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }]);
  });

  it("adds 1 to an existing product and keeps the line order", () => {
    const lines = [{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }];
    expect(addOrderLine(lines, 1)).toEqual([{ productId: 1, quantity: 3 }, { productId: 5, quantity: 1 }]);
  });

  it("does not mutate its input", () => {
    const lines = [{ productId: 1, quantity: 2 }];
    addOrderLine(lines, 1);
    addOrderLine(lines, 9);
    expect(lines).toEqual([{ productId: 1, quantity: 2 }]);
  });
});

describe("setOrderLineQuantity", () => {
  const lines = [{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }];

  it("sets the quantity of one line and leaves the others", () => {
    expect(setOrderLineQuantity(lines, 5, 4)).toEqual([{ productId: 1, quantity: 2 }, { productId: 5, quantity: 4 }]);
  });

  it("floors fractions and clamps anything below 1 to 1", () => {
    expect(setOrderLineQuantity(lines, 1, 3.9)[0].quantity).toBe(3);
    expect(setOrderLineQuantity(lines, 1, 0)[0].quantity).toBe(1);
    expect(setOrderLineQuantity(lines, 1, -4)[0].quantity).toBe(1);
    expect(setOrderLineQuantity(lines, 1, 0.5)[0].quantity).toBe(1);
    expect(setOrderLineQuantity(lines, 1, Number.NaN)[0].quantity).toBe(1);
    expect(setOrderLineQuantity(lines, 1, Number.POSITIVE_INFINITY)[0].quantity).toBe(1);
  });

  it("does not mutate its input", () => {
    setOrderLineQuantity(lines, 1, 9);
    expect(lines[0].quantity).toBe(2);
  });
});

describe("removeOrderLine", () => {
  it("removes only the given product", () => {
    const lines = [{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }];
    expect(removeOrderLine(lines, 1)).toEqual([{ productId: 5, quantity: 1 }]);
    expect(removeOrderLine(lines, 99)).toEqual(lines);
  });
});

describe("filterPickerProducts", () => {
  const products = [
    { id: 1, name: "Strip 2 pose", description: "Dua pose", kind: "PRINT" as const },
    { id: 2, name: "Kaos Poosefilm", description: null, kind: "MERCH" as const },
    { id: 3, name: "Polaroid", description: "Cetak instan", kind: "PRINT" as const },
  ];

  it("returns everything, in order, when nothing is filtered", () => {
    expect(filterPickerProducts(products, { q: "", kind: "" })).toEqual(products);
    expect(filterPickerProducts(products, { q: "   ", kind: "" })).toEqual(products);
  });

  it("searches the name and the description case-insensitively", () => {
    expect(filterPickerProducts(products, { q: "KAOS", kind: "" }).map((product) => product.id)).toEqual([2]);
    expect(filterPickerProducts(products, { q: "instan", kind: "" }).map((product) => product.id)).toEqual([3]);
    expect(filterPickerProducts(products, { q: "  pose ", kind: "" }).map((product) => product.id)).toEqual([1]);
  });

  it("filters by kind and treats an unknown kind as all kinds", () => {
    expect(filterPickerProducts(products, { q: "", kind: "PRINT" }).map((product) => product.id)).toEqual([1, 3]);
    expect(filterPickerProducts(products, { q: "", kind: "MERCH" }).map((product) => product.id)).toEqual([2]);
    expect(filterPickerProducts(products, { q: "", kind: "ALL" })).toEqual(products);
  });

  it("combines search and kind", () => {
    expect(filterPickerProducts(products, { q: "po", kind: "MERCH" }).map((product) => product.id)).toEqual([2]);
    expect(filterPickerProducts(products, { q: "po", kind: "PRINT" }).map((product) => product.id)).toEqual([1, 3]);
  });
});
