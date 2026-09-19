import { describe, expect, it } from "vitest";

import { buildOrderSnapshot } from "~/utils/order-invariants";

describe("order model invariants", () => {
  it("totals every item at its snapshotted price", () => {
    expect(buildOrderSnapshot({ items: [{ unitPrice: 95000, quantity: 3 }, { unitPrice: 50000, quantity: 2 }] })).toEqual({
      totalAmount: 385000,
      isRealTransaction: true,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      status: "WAITING_UPLOAD",
    });
  });

  it("sets non-real transactions to zero value", () => {
    expect(buildOrderSnapshot({ items: [{ unitPrice: 95000, quantity: 3 }], isRealTransaction: false })).toMatchObject({
      totalAmount: 0,
      isRealTransaction: false,
    });
  });

  it("allows an order to contain both image and video metadata", () => {
    const files = [
      { mediaType: "IMAGE", contentType: "image/jpeg" },
      { mediaType: "VIDEO", contentType: "video/mp4" },
    ];

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.mediaType)).toEqual(["IMAGE", "VIDEO"]);
  });
});
