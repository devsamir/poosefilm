import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("filter package schema", () => {
  it("contains immutable order snapshots and durable render jobs", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toContain("model FilterRenderJob");
    expect(schema).toContain("model OrderFilterSnapshot");
    expect(schema).toContain("filterPackageId");
    expect(schema).toContain("sourceFileId");
  });
});
