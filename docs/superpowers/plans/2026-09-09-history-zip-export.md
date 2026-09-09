# History ZIP Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff download every photo/video attachment from delivered orders in a chosen date range as one ZIP file, from the existing Riwayat (history) admin page.

**Architecture:** A new Remix resource route streams a ZIP built by `archiver`, appending each order file as a live stream read straight from Cloudflare R2 (no full-file buffering, no background job). The Riwayat page gains two date inputs and a plain download link pointing at that route.

**Tech Stack:** Remix (`@remix-run/node`), Prisma, `archiver` (new dependency), AWS SDK v3 S3 client (existing R2 wrapper), Vitest.

**Reference spec:** `docs/superpowers/specs/2026-09-09-history-zip-export-design.md`

---

## Task 1: Pure helpers — date range, filename, zip entry name

**Files:**
- Modify: `app/services/reports.server.ts`
- Test: `tests/history-export.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/history-export.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- history-export`
Expected: FAIL — `parseHistoryDateRange`, `buildHistoryZipFilename`, `buildHistoryZipEntryName` are not exported from `~/services/reports.server`.

- [ ] **Step 3: Implement the helpers**

Add to `app/services/reports.server.ts` (near the existing `getDateRange` function, after its closing brace at line 41):

```ts
const HISTORY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseHistoryDateRange(from: string, to: string) {
  if (!HISTORY_DATE_PATTERN.test(from) || !HISTORY_DATE_PATTERN.test(to)) throw new Error("Rentang tanggal tidak valid.");
  const start = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(toDate.getTime()) || start.getTime() > toDate.getTime()) throw new Error("Rentang tanggal tidak valid.");
  const end = new Date(toDate);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function buildHistoryZipFilename(from: string, to: string) {
  return `riwayat_${from}_${to}.zip`;
}

export function buildHistoryZipEntryName(orderCode: string, customerName: string, fileId: number, originalName: string) {
  return `${orderCode}_${sanitizeFilename(customerName)}/${fileId}-${sanitizeFilename(originalName)}`;
}
```

`app/services/reports.server.ts` does not currently import from `order-files.server`. Add a new import line after the existing three imports at the top of the file (after line 3, `import { serializeOrderMedia } from "~/utils/media";`):

```ts
import { sanitizeFilename } from "~/services/order-files.server";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- history-export`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/services/reports.server.ts tests/history-export.test.ts
git commit -m "$(cat <<'EOF'
feat: add pure helpers for history ZIP export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Query delivered orders in a date range

**Files:**
- Modify: `app/services/reports.server.ts:26-33` (the existing `listDeliveredOrders` function)

- [ ] **Step 1: Refactor the shared where-clause and add the range query**

Replace the existing `listDeliveredOrders` function in `app/services/reports.server.ts`:

```ts
export async function listDeliveredOrders(query: string, requestedPage = 1, pageSize = 12) {
  const search = query.trim();
  const where = { status: "DELIVERED" as const, ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" as const } }, { customerName: { contains: search, mode: "insensitive" as const } }, { whatsapp: { contains: search } }] } : {}) };
  const total = await prisma.order.count({ where });
  const pagination = getHistoryPagination(requestedPage, pageSize, total);
  const orders = await prisma.order.findMany({ where, include: { _count: { select: { files: true } }, files: { include: { filterSnapshot: true, renderJob: { select: { status: true, lastError: true } } }, orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.pageSize });
  return { orders: orders.map((order) => ({ ...order, files: serializeOrderMedia(order.code, order.files) })), total, pagination };
}
```

with this (extracts the shared where-clause builder, adds the new range query):

```ts
function buildDeliveredOrdersWhere(search: string, dateRange?: { start: Date; end: Date }) {
  return {
    status: "DELIVERED" as const,
    ...(dateRange ? { createdAt: { gte: dateRange.start, lt: dateRange.end } } : {}),
    ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" as const } }, { customerName: { contains: search, mode: "insensitive" as const } }, { whatsapp: { contains: search } }] } : {}),
  };
}

export async function listDeliveredOrders(query: string, requestedPage = 1, pageSize = 12) {
  const where = buildDeliveredOrdersWhere(query.trim());
  const total = await prisma.order.count({ where });
  const pagination = getHistoryPagination(requestedPage, pageSize, total);
  const orders = await prisma.order.findMany({ where, include: { _count: { select: { files: true } }, files: { include: { filterSnapshot: true, renderJob: { select: { status: true, lastError: true } } }, orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.pageSize });
  return { orders: orders.map((order) => ({ ...order, files: serializeOrderMedia(order.code, order.files) })), total, pagination };
}

export async function listDeliveredOrdersInRange(start: Date, end: Date, query: string) {
  const where = buildDeliveredOrdersWhere(query.trim(), { start, end });
  return prisma.order.findMany({ where, include: { files: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "asc" } });
}
```

- [ ] **Step 2: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS — all existing tests (including `tests/public-order.test.ts`'s history-page content checks and `getHistoryPagination` test) still pass unchanged, since `listDeliveredOrders`'s behavior and `where` shape are unchanged.

- [ ] **Step 3: Commit**

```bash
git add app/services/reports.server.ts
git commit -m "$(cat <<'EOF'
refactor: extract shared delivered-orders where-clause, add range query

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Stream a single R2 object

**Files:**
- Modify: `app/services/r2.server.ts`

- [ ] **Step 1: Add `getObjectStream`**

Add to `app/services/r2.server.ts`, after the existing `getObjectBuffer` function (after line 38):

```ts
export async function getObjectStream(key: string) {
  const { client: r2Client, bucket } = getClient();
  const response = await r2Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error("Object R2 tidak memiliki isi.");
  return response.Body as Readable;
}
```

Add `Readable` to the imports at the top of the file (currently line 1-2 only import from `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`):

```ts
import { Readable } from "node:stream";
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors from `app/services/r2.server.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/services/r2.server.ts
git commit -m "$(cat <<'EOF'
feat: add streaming R2 object reader for ZIP export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add the `archiver` dependency

- [ ] **Step 1: Install**

Run: `npm install archiver @types/archiver`
Expected: `package.json` and `package-lock.json` gain `archiver` under `dependencies` and `@types/archiver` under `devDependencies`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: add archiver dependency for ZIP export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Export route

**Files:**
- Create: `app/routes/api.history.export-zip.ts`

- [ ] **Step 1: Write the route**

```ts
import { type LoaderFunctionArgs } from "@remix-run/node";
import archiver from "archiver";
import { Readable } from "node:stream";

import { requireUser } from "~/services/auth.server";
import { getObjectStream } from "~/services/r2.server";
import { buildHistoryZipEntryName, buildHistoryZipFilename, listDeliveredOrdersInRange, parseHistoryDateRange } from "~/services/reports.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const query = url.searchParams.get("q") || "";

  let range: { start: Date; end: Date };
  try {
    range = parseHistoryDateRange(from, to);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Rentang tanggal tidak valid.", { status: 400 });
  }

  const orders = await listDeliveredOrdersInRange(range.start, range.end, query);
  if (!orders.length) return new Response("Tidak ada riwayat pada rentang tanggal ini.", { status: 400 });

  const archive = archiver("zip");
  for (const order of orders) {
    for (const file of order.files) {
      try {
        const stream = await getObjectStream(file.storageKey);
        archive.append(stream, { name: buildHistoryZipEntryName(order.code, order.customerName, file.id, file.originalName) });
      } catch (error) {
        console.warn(`Lewati file yang gagal di-stream: ${order.code} - ${file.originalName}`, error);
      }
    }
  }
  archive.finalize();

  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${buildHistoryZipFilename(from, to)}"`,
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `Readable.toWeb(archive)` reports a type mismatch against `ReadableStream` from the DOM lib, the `as unknown as ReadableStream` cast already in the code above resolves it — this is the standard cast needed when mixing Node's `stream/web` types with DOM lib types in this tsconfig (`lib: ["DOM", ...]` + `types: ["node", ...]`).

- [ ] **Step 3: Commit**

```bash
git add app/routes/api.history.export-zip.ts
git commit -m "$(cat <<'EOF'
feat: add streaming ZIP export route for history date range

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Testing note (deviation from spec):** the design spec's Testing section proposed a route-level test with a mocked R2 stream asserting `Content-Type`/`Content-Disposition`/400s. This codebase has no `vi.mock` usage anywhere (checked: zero matches in `tests/`) and no route under `app/routes/api.*` has a dedicated test — routes are exercised manually (see Task 7) while their underlying logic is unit-tested as plain functions. Introducing mocking machinery for this one route would be new, unshared infrastructure for a single call site. The route's actual logic (date validation, empty-range check, entry naming) is already covered by Task 1's and Task 2's tests since the route calls those functions directly; only the HTTP/stream plumbing itself is left to manual verification in Task 7, consistent with how `api.order.$code.file.$fileId.download.ts` is handled today.

---

## Task 6: Riwayat page UI

**Files:**
- Modify: `app/routes/admin.history.tsx`
- Test: `tests/history-export.test.ts` (extend)

- [ ] **Step 1: Write the failing UI content test**

Add to `tests/history-export.test.ts` (new `describe` block, after the helpers block):

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("history page export UI", () => {
  it("wires up the date-range export controls on the history page", () => {
    const historyPage = readFileSync(resolve(process.cwd(), "app/routes/admin.history.tsx"), "utf8");
    expect(historyPage).toContain('type="date"');
    expect(historyPage).toContain("/api/history/export-zip");
    expect(historyPage).toContain("Download ZIP");
  });
});
```

(Add the `readFileSync`/`resolve` imports to the top of the file alongside the existing `describe`/`expect`/`it` import from `"vitest"`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- history-export`
Expected: FAIL — `admin.history.tsx` doesn't contain `type="date"` yet.

- [ ] **Step 3: Add the date-range export controls**

In `app/routes/admin.history.tsx`, add state for the two dates right after the existing `const query = searchParams.get("q") || "";` (line 60):

```tsx
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const exportHref = exportFrom && exportTo ? `/api/history/export-zip?${new URLSearchParams({ from: exportFrom, to: exportTo, ...(query ? { q: query } : {}) }).toString()}` : undefined;
```

Then add a new row right after the existing header `<div className="flex flex-wrap items-end justify-between gap-4">...</div>` block (after line 63, before the `{actionData?.error ...}` line):

```tsx
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e6ded2] bg-white p-4">
      <div><label className="block text-xs text-[#84796c]" htmlFor="export-from">Dari tanggal</label><input id="export-from" type="date" className="field-input" value={exportFrom} onChange={(event) => setExportFrom(event.target.value)} /></div>
      <div><label className="block text-xs text-[#84796c]" htmlFor="export-to">Sampai tanggal</label><input id="export-to" type="date" className="field-input" value={exportTo} onChange={(event) => setExportTo(event.target.value)} /></div>
      {exportHref ? <a className="button-secondary text-xs" href={exportHref}>Download ZIP</a> : <span className="button-secondary text-xs pointer-events-none opacity-40" aria-disabled="true">Download ZIP</span>}
    </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- history-export`
Expected: PASS (7 tests total in this file)

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin.history.tsx tests/history-export.test.ts
git commit -m "$(cat <<'EOF'
feat: add date-range ZIP export controls to Riwayat page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Start the dev server and exercise the feature in a browser**

Run: `npm run dev`

In the browser:
1. Log in, go to `/admin/history`.
2. Confirm the "Download ZIP" link is greyed out until both dates are filled.
3. Pick a `from`/`to` range that covers at least one delivered order with an uploaded photo and (if available) a video, click "Download ZIP".
4. Confirm a `.zip` file downloads, opens, and contains the expected files under `<code>_<customerName>/<fileId>-<name>` entries.
5. Pick a range with zero delivered orders; confirm the browser shows the "Tidak ada riwayat pada rentang tanggal ini." response instead of an empty/broken zip.

- [ ] **Step 3: Stop the dev server**

No commit for this task — it's verification only.
