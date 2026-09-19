import { describe, expect, it } from "vitest";

import { buildProductsWhere } from "~/services/products.server";

describe("buildProductsWhere", () => {
  it("returns no conditions when nothing is filtered", () => {
    expect(buildProductsWhere({ q: "", kind: "", status: "" })).toEqual({});
  });

  it("searches name and description case-insensitively and trims the term", () => {
    expect(buildProductsWhere({ q: "  polaroid ", kind: "", status: "" })).toEqual({
      OR: [
        { name: { contains: "polaroid", mode: "insensitive" } },
        { description: { contains: "polaroid", mode: "insensitive" } },
      ],
    });
  });

  it("filters by kind and ignores unknown kinds", () => {
    expect(buildProductsWhere({ q: "", kind: "MERCH", status: "" })).toEqual({ kind: "MERCH" });
    expect(buildProductsWhere({ q: "", kind: "ALL", status: "" })).toEqual({});
    expect(buildProductsWhere({ q: "", kind: "merch", status: "" })).toEqual({});
  });

  it("filters by status and ignores unknown statuses", () => {
    expect(buildProductsWhere({ q: "", kind: "", status: "ACTIVE" })).toEqual({ isActive: true });
    expect(buildProductsWhere({ q: "", kind: "", status: "INACTIVE" })).toEqual({ isActive: false });
    expect(buildProductsWhere({ q: "", kind: "", status: "ALL" })).toEqual({});
  });

  it("combines every filter", () => {
    expect(buildProductsWhere({ q: "kaos", kind: "MERCH", status: "ACTIVE" })).toEqual({
      OR: [
        { name: { contains: "kaos", mode: "insensitive" } },
        { description: { contains: "kaos", mode: "insensitive" } },
      ],
      kind: "MERCH",
      isActive: true,
    });
  });
});
