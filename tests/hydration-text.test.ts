import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin text encoding", () => {
  it("does not render raw non-ASCII separators in server-rendered queue text", () => {
    const queueRoute = readFileSync("app/routes/admin.queue.tsx", "utf8");
    expect(queueRoute).not.toContain("·");
  });
});
