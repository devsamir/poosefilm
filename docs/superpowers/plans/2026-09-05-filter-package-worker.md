# Filter Package Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add superadmin-managed filter/package masters, cashier package selection, and durable server-side image variant generation on the Hostinger VPS.

**Architecture:** Orders snapshot their selected filter configuration at creation. Upload completion stores the original and enqueues one database-backed render job per original image; a separate Node worker claims jobs, uses Sharp to generate independent variants, uploads them to R2, and records them in PostgreSQL. PM2 runs the Remix web process and worker independently.

**Tech Stack:** Remix, React, Prisma, PostgreSQL, Cloudflare R2 via AWS SDK, Sharp, Node.js, PM2.

**Spec:** `docs/superpowers/specs/2026-09-05-filter-package-worker-design.md`

## Global Constraints

- Package selection is in Kasir and does not change price in this release.
- Every package filter is applied independently to the original; no chaining.
- Videos remain original-only.
- Only active superadmins can create, edit, or delete filter/package masters.
- Existing uncommitted work is preserved; do not reset or discard unrelated changes.
- Do not run Prisma migration deploy/dev until the repository migration history is reconciled.

---

### Task 1: Add pure filter and package domain helpers

**Files:**
- Create: `app/utils/filter-domain.ts`
- Test: `tests/filter-domain.test.ts`

**Interfaces:**
- Produces `FilterValueInput`, `FilterSnapshotInput`, `SUPPORTED_FILTER_TYPES`, `validateFilterValues(values)`, `generateFilterCss(values)`, and `expandPackageFilters(filters)` for schema/services/routes.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { expandPackageFilters, generateFilterCss, validateFilterValues } from "~/utils/filter-domain";

describe("filter domain", () => {
  it("generates deterministic CSS with defaults and overrides", () => {
    expect(generateFilterCss([{ filterType: "grayscale", value: "80%" }])).toContain("grayscale(80%)");
    expect(generateFilterCss([{ filterType: "grayscale", value: "80%" }])).toContain("brightness(100%)");
  });

  it("rejects unsupported filter names and malformed values", () => {
    expect(() => validateFilterValues([{ filterType: "drop-shadow", value: "red" }])).toThrow();
    expect(() => validateFilterValues([{ filterType: "blur", value: "bad" }])).toThrow();
  });

  it("expands package filters in order without chaining", () => {
    expect(expandPackageFilters([{ id: 1, name: "Warm", css: "sepia(20%)" }, { id: 2, name: "Mono", css: "grayscale(100%)" }])).toEqual([
      { filterId: 1, filterName: "Warm", css: "sepia(20%)", sortOrder: 0 },
      { filterId: 2, filterName: "Mono", css: "grayscale(100%)", sortOrder: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/filter-domain.test.ts`

Expected: FAIL because `app/utils/filter-domain.ts` does not exist.

- [ ] **Step 3: Implement the minimal domain helpers**

Define the nine supported functions and their default values. Validate each function against its configured unit/range, return a stable CSS string in the configured order, and map package filters to independent snapshot inputs with zero-based sort order.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- tests/filter-domain.test.ts`

Expected: PASS.

### Task 2: Add Prisma models and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260905110000_add_filter_packages_and_render_jobs/migration.sql`
- Test: `tests/filter-schema.test.ts`

**Interfaces:**
- Produces Prisma models for `FilterTemplate`, `FilterTemplateValue`, `FilterPackage`, `FilterPackageItem`, `OrderFilterSnapshot`, and `FilterRenderJob`; extends `Order` and `OrderFile` with package/snapshot/job relations.

- [ ] **Step 1: Write the failing schema assertions**

```ts
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
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/filter-schema.test.ts`

Expected: FAIL because the new models and fields are absent.

- [ ] **Step 3: Add the schema**

Use enums for filter render status and file variant kind. Add uniqueness for filter names, package names, package/filter pairs, source-file jobs, and source-file/filter-snapshot variants. Use cascading relations for package values/items and derived files while retaining the original order relation.

- [ ] **Step 4: Add the SQL migration**

Create enum types, tables, indexes, nullable order/file columns, foreign keys, and a null-safe default for any new required status fields. Do not apply it automatically in this repository.

- [ ] **Step 5: Generate Prisma and run the focused test**

Run: `npx prisma generate; npm test -- tests/filter-schema.test.ts`

Expected: PASS. If the local dev process locks the Prisma engine, stop only the Poosefilm process before generation and restart it afterward.

### Task 3: Implement superadmin filter/package services

**Files:**
- Create: `app/services/filter-packages.server.ts`
- Modify: `app/routes/admin.settings.tsx`
- Test: `tests/filter-packages.test.ts`

**Interfaces:**
- Produces `listFilterTemplates`, `createFilterTemplate`, `updateFilterTemplate`, `deleteFilterTemplate`, `listFilterPackages`, `createFilterPackage`, `updateFilterPackage`, `deleteFilterPackage`, and `getActiveFilterPackages`.

- [ ] **Step 1: Write failing service and route contract tests**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("filter package administration", () => {
  it("keeps filter and package administration behind superadmin access", () => {
    const settings = readFileSync(resolve(process.cwd(), "app/routes/admin.settings.tsx"), "utf8");
    expect(settings).toContain("requireSuperadmin");
    expect(settings).toContain("filterPackage");
    expect(settings).toContain("filterTemplate");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/filter-packages.test.ts`

Expected: FAIL because Settings has no filter/package sections.

- [ ] **Step 3: Implement validated CRUD services**

Use `validateFilterValues` and `generateFilterCss` for all writes/reads. Update nested values/items transactionally, reject duplicate names, and return active package filters with generated CSS for cashier and worker use.

- [ ] **Step 4: Add Settings sections**

Add superadmin-only forms and lists for filter templates and packages. Reuse the existing settings action pattern with explicit `intent` values and confirmation before deletes. Do not expose these sections to staff.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- tests/filter-packages.test.ts; npm run typecheck`

Expected: PASS.

### Task 4: Snapshot package selection during order creation

**Files:**
- Modify: `app/routes/admin.cashier.tsx`
- Modify: `app/services/orders.server.ts`
- Modify: `app/services/order-invariants.ts`
- Test: `tests/order-models.test.ts`

**Interfaces:**
- `createOrder(input, createdById)` accepts `filterPackageId?: number` and creates immutable `OrderFilterSnapshot` rows in the same transaction.

- [ ] **Step 1: Write failing order snapshot tests**

```ts
it("keeps package selection separate from order pricing", () => {
  const source = readFileSync(resolve(process.cwd(), "app/services/orders.server.ts"), "utf8");
  expect(source).toContain("filterPackageId");
  expect(source).toContain("OrderFilterSnapshot");
  expect(source).toContain("totalAmount");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/order-models.test.ts`

Expected: FAIL because order creation does not accept or snapshot a package.

- [ ] **Step 3: Load active packages in the cashier loader**

Return package id, name, and ordered filters. Render an optional `Tanpa filter` selector and submit `filterPackageId` only when selected.

- [ ] **Step 4: Snapshot filters inside order creation**

Fetch the selected active package, build filter snapshots from its current CSS values, persist `filterPackageId`, and leave total price calculation unchanged.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- tests/order-models.test.ts; npm run typecheck`

Expected: PASS.

### Task 5: Enqueue image render jobs after upload completion

**Files:**
- Modify: `app/services/order-files.server.ts`
- Modify: `app/routes/api.orders.$code.files.complete.ts`
- Create: `app/services/filter-render-jobs.server.ts`
- Test: `tests/filter-render-jobs.test.ts`

**Interfaces:**
- Produces `enqueueImageRenderJob(orderFileId)`, `getOrderProcessingState(orderId)`, and `canDeliverOrder(orderId)`.

- [ ] **Step 1: Write failing job creation tests**

```ts
it("creates one render job for a completed package image and none for video", () => {
  const source = readFileSync(resolve(process.cwd(), "app/services/order-files.server.ts"), "utf8");
  expect(source).toContain("enqueueImageRenderJob");
  expect(source).toContain('mediaType === "IMAGE"');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/filter-render-jobs.test.ts`

Expected: FAIL because completion currently marks the order ready immediately and creates no job.

- [ ] **Step 3: Add idempotent job creation**

After original file creation, inspect order snapshots. Create one `PENDING` job only for images with filters; keep video behavior unchanged. Use the unique source-file constraint to make retries safe.

- [ ] **Step 4: Gate order readiness and delivery**

Keep the order in a processing/waiting state while jobs are pending. Update the status only after all render jobs complete. Make `markOrderDelivered` reject orders with pending/failed jobs.

- [ ] **Step 5: Expose processing state to queue/history**

Return pending/failed render counts and variant labels in authenticated admin serializers. Keep customer serialization limited to completed files.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npm test -- tests/filter-render-jobs.test.ts; npm run typecheck`

Expected: PASS.

### Task 6: Add Sharp processor and R2 worker

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `app/services/filter-processor.server.ts`
- Create: `app/worker/filter-render-worker.ts`
- Create: `ecosystem.config.cjs`
- Test: `tests/filter-processor.test.ts`

**Interfaces:**
- `processFilterImage(input: { source: Buffer; filter: FilterSnapshotInput }): Promise<Buffer>` produces a derived image buffer.
- `claimNextRenderJob()` and `processRenderJob(jobId)` implement durable worker processing.

- [ ] **Step 1: Write failing processor tests**

```ts
import sharp from "sharp";

it("renders each filter from the same original input", async () => {
  const source = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 120, g: 80, b: 40 } } }).jpeg().toBuffer();
  const warm = await processFilterImage({ source, filter: { filterName: "Warm", css: "sepia(20%)" } });
  const mono = await processFilterImage({ source, filter: { filterName: "Mono", css: "grayscale(100%)" } });
  expect(warm).not.toEqual(source);
  expect(mono).not.toEqual(source);
  expect(warm).not.toEqual(mono);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/filter-processor.test.ts`

Expected: FAIL because Sharp and the processor do not exist.

- [ ] **Step 3: Add Sharp and implement validated operations**

Install `sharp`. Map the supported filter values to Sharp operations without shell evaluation. Preserve image format as JPEG for generated variants, cap output dimensions only if existing upload constraints require it, and document any CSS-equivalence limitations.

- [ ] **Step 4: Implement durable job claiming**

Use a PostgreSQL transaction with row locking/lease fields so a worker crash makes a job claimable again after the lease timeout. Process one job at a time initially, upload derived objects under deterministic keys, create rows with unique constraints, and mark completion only after all outputs are durable.

- [ ] **Step 5: Add worker entrypoint and PM2 config**

Start a polling loop with graceful shutdown, bounded retry count/backoff, and structured error logging. Configure `poosefilm-web` to run `npm start` and `poosefilm-worker` to run `node --import tsx app/worker/filter-render-worker.ts` after build/runtime dependencies are installed.

- [ ] **Step 6: Run focused processor tests**

Run: `npm test -- tests/filter-processor.test.ts`

Expected: PASS.

### Task 7: Update admin/customer UI and upload status

**Files:**
- Modify: `app/routes/admin.queue.tsx`
- Modify: `app/routes/admin.history.tsx`
- Modify: `app/components/MediaGallery.tsx`
- Modify: `app/components/UploadManager.tsx`
- Modify: `app/routes/order.$code.tsx`
- Test: `tests/public-order.test.ts`

**Interfaces:**
- Admin cards show selected package and filter processing counts.
- Customer pages show original and completed variants with filter names.

- [ ] **Step 1: Write failing UI contract tests**

```ts
it("exposes filtered variants and processing state to the relevant pages", () => {
  const queue = readFileSync(resolve(process.cwd(), "app/routes/admin.queue.tsx"), "utf8");
  const publicPage = readFileSync(resolve(process.cwd(), "app/routes/order.$code.tsx"), "utf8");
  expect(queue).toContain("processing");
  expect(publicPage).toContain("filterName");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/public-order.test.ts`

Expected: FAIL because pages currently know only original upload files.

- [ ] **Step 3: Add processing labels, retry, and delivery guards**

Display `Memproses filter`, `Filter gagal`, or `Siap dikirim` based on job state. Add a staff-only `POST /api/orders/:code/filter-jobs/retry` action that resets failed jobs to `PENDING`. Keep `Tandai selesai` disabled until `canDeliverOrder` is true.

- [ ] **Step 4: Show variant metadata**

Extend media serialization with `variantKind`, `sourceFileId`, and filter name. Render compact labels in admin galleries and separate original/filtered items in the public page.

- [ ] **Step 5: Keep client upload progress independent**

Leave the global upload manager responsible for the R2 original upload only. After completion, refresh the route data to observe worker progress; do not block or cancel worker jobs on navigation.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npm test -- tests/public-order.test.ts; npm run typecheck`

Expected: PASS.

### Task 8: Full verification and deployment documentation

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Test: all existing tests

- [ ] **Step 1: Document VPS setup**

Document `npm install`, Prisma generation/migration procedure, required R2/database variables, PM2 startup commands, log inspection, and worker restart behavior. Include the `pos.poosebox.id` reverse proxy requirement.

- [ ] **Step 2: Run the complete verification suite**

Run: `npm test`

Expected: all tests pass.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: client and SSR bundles build successfully.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Review migration safety**

Run: `npx prisma migrate status`

Expected: migration history is explicitly reviewed before any production apply. Do not apply a migration from this repository until its history is reconciled according to the project constraint.
