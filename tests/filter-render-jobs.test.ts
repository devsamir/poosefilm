import { describe, expect, it } from "vitest";

import { buildDerivedFilterStorageKey, getRetryDelayMs, shouldRenderFilters } from "~/utils/filter-jobs";

describe("filter render jobs", () => {
  it("only renders image originals when an order has snapshots", () => {
    expect(shouldRenderFilters("IMAGE", 2)).toBe(true);
    expect(shouldRenderFilters("VIDEO", 2)).toBe(false);
    expect(shouldRenderFilters("IMAGE", 0)).toBe(false);
  });

  it("builds a deterministic derived R2 key", () => {
    expect(buildDerivedFilterStorageKey("PB260905-ABC12345", 17, 4)).toBe("orders/PB260905-ABC12345/filtered/17-4.jpg");
  });

  it("backs off retries without delaying the first retry", () => {
    expect(getRetryDelayMs(1)).toBe(0);
    expect(getRetryDelayMs(2)).toBe(30_000);
    expect(getRetryDelayMs(4)).toBe(120_000);
  });
});
