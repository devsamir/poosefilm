import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("filter worker observability", () => {
  it("logs worker startup, claims, completions, and failures", () => {
    const source = readFileSync(resolve(process.cwd(), "app/worker/filter-render-worker.ts"), "utf8");
    expect(source).toContain("Filter render worker started");
    expect(source).toContain("Filter render job claimed");
    expect(source).toContain("Filter render job completed");
    expect(source).toContain("Filter render job failed");
  });

  it("ships a harmless service worker for stale Firebase registration requests", () => {
    expect(existsSync(resolve(process.cwd(), "public/firebase-messaging-sw.js"))).toBe(true);
  });

  it("starts the web process and filter worker together in local development", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.dev).toContain("dev-with-worker.mjs");
    expect(existsSync(resolve(process.cwd(), "scripts/dev-with-worker.mjs"))).toBe(true);
  });
});
