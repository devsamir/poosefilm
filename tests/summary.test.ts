import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { getOrderSummary } from "~/services/reports.server";
import { getSummaryDateRange, readSummaryPeriod } from "~/utils/summary-period";

const database = vi.hoisted(() => ({
  order: { groupBy: vi.fn() },
  orderItem: { aggregate: vi.fn(), groupBy: vi.fn() },
}));

vi.mock("~/services/prisma.server", () => ({
  prisma: { $transaction: (read: (client: typeof database) => unknown) => read(database) },
}));

describe("Rekap period", () => {
  it.each([
    ["2026-11-24T01:00:00Z", "2026-11-01", "2026-11-30"],
    ["2028-01-31T17:00:00Z", "2028-02-01", "2028-02-29"],
    ["2026-12-31T16:59:59Z", "2026-12-01", "2026-12-31"],
    ["2026-12-31T17:00:00Z", "2027-01-01", "2027-01-31"],
  ])("defaults to the entire month in WIB at %s", (now, from, to) => {
    expect(readSummaryPeriod(new URLSearchParams(), new Date(now))).toEqual({ from, to });
  });

  it("supports legacy single-day links and prefers an explicit range", () => {
    const now = new Date("2026-11-24T01:00:00Z");
    expect(readSummaryPeriod(new URLSearchParams("date=2026-08-21"), now)).toEqual({ from: "2026-08-21", to: "2026-08-21" });
    const period = readSummaryPeriod(new URLSearchParams("date=2026-08-21&from=2026-10-29&to=2026-11-02"), now);
    expect(getSummaryDateRange(period)).toEqual({
      start: new Date("2026-10-28T17:00:00Z"),
      end: new Date("2026-11-02T17:00:00Z"),
    });
  });

  it.each([
    { from: "2026-11-30", to: "2026-11-01" },
    { from: "2026-02-29", to: "2026-03-01" },
    { from: "2026-11-1", to: "2026-11-03" },
    { from: "2026-11-01", to: "" },
  ])("rejects invalid periods %j", (period) => {
    expect(getSummaryDateRange(period)).toBeNull();
  });
});

describe("Rekap aggregation", () => {
  const range = { start: new Date("2026-10-31T17:00:00Z"), end: new Date("2026-11-30T17:00:00Z") };
  const createdAt = { gte: range.start, lt: range.end };

  it("counts matching orders once and uses snapshot quantity and prices for the chosen product", async () => {
    database.order.groupBy.mockResolvedValueOnce([
      { status: "DELIVERED", isRealTransaction: true, _count: { _all: 2 }, _sum: { totalAmount: new Prisma.Decimal(90000) } },
      { status: "PROCESSING_FILTER", isRealTransaction: false, _count: { _all: 1 }, _sum: { totalAmount: new Prisma.Decimal(0) } },
    ]);
    database.orderItem.groupBy.mockResolvedValueOnce([
      { unitPrice: new Prisma.Decimal(10000), productKind: "PRINT", _sum: { quantity: 2 } },
      { unitPrice: new Prisma.Decimal(12500), productKind: "MERCH", _sum: { quantity: 1 } },
    ]);

    expect(await getOrderSummary({ range, productId: 7, filterPackageId: 4 })).toEqual({
      totalOrders: 3, realOrders: 2, freeOrders: 1, totalPrints: 2, revenue: 32500, delivered: 2, waiting: 1,
    });
    expect(database.order.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt, filterPackageId: 4, items: { some: { productId: 7 } } },
    }));
    expect(database.orderItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 7, order: { createdAt, filterPackageId: 4, isRealTransaction: true } },
    }));
  });

  it("uses original order totals without a product filter and supports orders without a package", async () => {
    database.order.groupBy.mockResolvedValueOnce([
      { status: "READY", isRealTransaction: true, _count: { _all: 1 }, _sum: { totalAmount: new Prisma.Decimal(55000) } },
      { status: "DELIVERED", isRealTransaction: false, _count: { _all: 1 }, _sum: { totalAmount: new Prisma.Decimal(9000) } },
    ]);
    database.orderItem.aggregate.mockResolvedValueOnce({ _sum: { quantity: 3 } });

    expect(await getOrderSummary({ range, filterPackageId: null })).toEqual({
      totalOrders: 2, realOrders: 1, freeOrders: 1, totalPrints: 3, revenue: 55000, delivered: 1, waiting: 1,
    });
    expect(database.order.groupBy).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { createdAt, filterPackageId: null },
    }));
    expect(database.orderItem.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { productKind: "PRINT", order: { createdAt, filterPackageId: null, isRealTransaction: true } },
    }));
  });
});
