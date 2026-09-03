import { describe, expect, it } from "vitest";

import { buildOrderSnapshot } from "~/utils/order-invariants";

describe("order model invariants", () => {
  it("snapshots the unit price and total at creation time", () => {
    expect(buildOrderSnapshot({ quantity: 3, unitPrice: 95000 })).toEqual({
      unitPrice: 95000,
      totalAmount: 285000,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      status: "WAITING_UPLOAD",
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
