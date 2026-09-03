import { describe, expect, it } from "vitest";

import { PRIMARY_NAVIGATION } from "~/components/AppShell";

describe("admin shell navigation", () => {
  it("keeps the four operational areas in the primary navbar", () => {
    expect(PRIMARY_NAVIGATION.map(([label]) => label)).toEqual(["Kasir", "Antrian", "Riwayat", "Rekap"]);
  });
});
