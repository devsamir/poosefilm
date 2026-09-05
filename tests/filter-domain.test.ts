import { describe, expect, it } from "vitest";

import { expandPackageFilters, generateFilterCss, validateFilterValues } from "~/utils/filter-domain";

describe("filter domain", () => {
  it("generates deterministic CSS with defaults and overrides", () => {
    expect(generateFilterCss([{ filterType: "grayscale", value: "80%" }])).toContain("grayscale(80%)");
    expect(generateFilterCss([{ filterType: "grayscale", value: "80%" }])).toContain("brightness(100%)");
  });

  it("rejects unsupported filter names and malformed values", () => {
    expect(() => validateFilterValues([{ filterType: "drop-shadow", value: "red" }])).toThrow();
    expect(() => validateFilterValues([{ filterType: "blur", value: "bad" }])).toThrow();
    expect(() => validateFilterValues([{ filterType: "blur", value: "8pxbad" }])).toThrow();
  });

  it("expands package filters in order without chaining", () => {
    expect(expandPackageFilters([{ id: 1, name: "Warm", css: "sepia(20%)" }, { id: 2, name: "Mono", css: "grayscale(100%)" }])).toEqual([
      { filterId: 1, filterName: "Warm", css: "sepia(20%)", sortOrder: 0 },
      { filterId: 2, filterName: "Mono", css: "grayscale(100%)", sortOrder: 1 },
    ]);
  });
});
