import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildDeliveredOrdersWhere, buildHistoryZipEntryName, buildHistoryZipFilename, parseHistoryDateRange } from "~/services/reports.server";

describe("history ZIP export helpers", () => {
  it("parses a valid inclusive date range into local day boundaries", () => {
    const range = parseHistoryDateRange("2026-09-01", "2026-09-09");
    expect(range.start).toEqual(new Date("2026-09-01T00:00:00"));
    expect(range.end).toEqual(new Date("2026-09-10T00:00:00"));
  });

  it("accepts a single-day range where from equals to", () => {
    const range = parseHistoryDateRange("2026-09-05", "2026-09-05");
    expect(range.start).toEqual(new Date("2026-09-05T00:00:00"));
    expect(range.end).toEqual(new Date("2026-09-06T00:00:00"));
  });

  it("rejects a reversed range", () => {
    expect(() => parseHistoryDateRange("2026-09-09", "2026-09-01")).toThrow("Rentang tanggal tidak valid.");
  });

  it("rejects malformed or empty dates", () => {
    expect(() => parseHistoryDateRange("", "2026-09-09")).toThrow("Rentang tanggal tidak valid.");
    expect(() => parseHistoryDateRange("2026-09-01", "not-a-date")).toThrow("Rentang tanggal tidak valid.");
    expect(() => parseHistoryDateRange("2026-9-1", "2026-09-09")).toThrow("Rentang tanggal tidak valid.");
  });

  it("rejects an invalid calendar date that rolls forward instead of throwing", () => {
    expect(() => parseHistoryDateRange("2026-02-30", "2026-02-30")).toThrow("Rentang tanggal tidak valid.");
  });

  it("rejects a rolling-month date like April 31st", () => {
    expect(() => parseHistoryDateRange("2026-04-31", "2026-04-31")).toThrow("Rentang tanggal tidak valid.");
  });

  it("builds a zip filename from the raw from/to strings", () => {
    expect(buildHistoryZipFilename("2026-09-01", "2026-09-09")).toBe("riwayat_2026-09-01_2026-09-09.zip");
  });

  it("builds a sanitized, collision-safe per-file entry path inside the zip", () => {
    expect(buildHistoryZipEntryName("PB260903-01020304", "Budi Santoso", 7, "photo one.jpg")).toBe("PB260903-01020304_Budi-Santoso/7-photo-one.jpg");
    expect(buildHistoryZipEntryName("PB260903-01020304", "A/B", 12, "clip.mp4")).toBe("PB260903-01020304_A-B/12-clip.mp4");
  });
});

describe("delivered orders where-clause", () => {
  it("always scopes to DELIVERED orders with no date range or search", () => {
    expect(buildDeliveredOrdersWhere("")).toEqual({ status: "DELIVERED" });
  });

  it("adds an inclusive/exclusive createdAt range only when one is given", () => {
    const start = new Date("2026-09-01T00:00:00");
    const end = new Date("2026-09-10T00:00:00");
    expect(buildDeliveredOrdersWhere("", { start, end })).toEqual({
      status: "DELIVERED",
      createdAt: { gte: start, lt: end },
    });
  });

  it("adds a case-insensitive OR search across code/customerName/whatsapp only when given", () => {
    expect(buildDeliveredOrdersWhere("budi")).toEqual({
      status: "DELIVERED",
      OR: [
        { code: { contains: "budi", mode: "insensitive" } },
        { customerName: { contains: "budi", mode: "insensitive" } },
        { whatsapp: { contains: "budi" } },
      ],
    });
  });

  it("combines the date range and search when both are given", () => {
    const start = new Date("2026-09-01T00:00:00");
    const end = new Date("2026-09-10T00:00:00");
    expect(buildDeliveredOrdersWhere("budi", { start, end })).toEqual({
      status: "DELIVERED",
      createdAt: { gte: start, lt: end },
      OR: [
        { code: { contains: "budi", mode: "insensitive" } },
        { customerName: { contains: "budi", mode: "insensitive" } },
        { whatsapp: { contains: "budi" } },
      ],
    });
  });
});

describe("history page export UI", () => {
  it("wires up the date-range export controls on the history page", () => {
    const historyPage = readFileSync(resolve(process.cwd(), "app/routes/admin.history.tsx"), "utf8");
    expect(historyPage).toContain('type="date"');
    expect(historyPage).toContain("/api/history/export-zip");
    expect(historyPage).toContain("Download ZIP");
  });
});
