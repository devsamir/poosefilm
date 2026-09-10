import { describe, expect, it } from "vitest";

import { buildHistoryZipEntryName, buildHistoryZipFilename, parseHistoryDateRange } from "~/services/reports.server";

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

  it("builds a zip filename from the raw from/to strings", () => {
    expect(buildHistoryZipFilename("2026-09-01", "2026-09-09")).toBe("riwayat_2026-09-01_2026-09-09.zip");
  });

  it("builds a sanitized, collision-safe per-file entry path inside the zip", () => {
    expect(buildHistoryZipEntryName("PB260903-01020304", "Budi Santoso", 7, "photo one.jpg")).toBe("PB260903-01020304_Budi-Santoso/7-photo-one.jpg");
    expect(buildHistoryZipEntryName("PB260903-01020304", "A/B", 12, "clip.mp4")).toBe("PB260903-01020304_A-B/12-clip.mp4");
  });
});
