# Marketing Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff record a "customer allows sharing photos on Poosefilm's social media" checkbox at order creation, and filter the Riwayat page down to only those orders when picking photos to post.

**Architecture:** One new boolean column on `Order` (`marketingConsent`, default `false`), set once in the Kasir order-creation form and never edited afterward. The Riwayat page gains a checkbox that adds `?consent=1` to its existing search URL, and the Prisma query that powers it gets an optional `marketingConsent: true` clause.

**Tech Stack:** Remix, Prisma (PostgreSQL), TypeScript, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-09-11-marketing-consent-design.md`

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_marketing_consent_flag/migration.sql` (generated, not hand-written)

- [ ] **Step 1: Add the field to the schema**

In `prisma/schema.prisma`, in the `Order` model, add a new line directly after `isRealTransaction` (currently `isRealTransaction Boolean @default(true) @map("is_real_transaction")`):

```prisma
  isRealTransaction Boolean               @default(true) @map("is_real_transaction")
  marketingConsent  Boolean               @default(false) @map("marketing_consent")
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_marketing_consent_flag`

Expected: creates `prisma/migrations/<timestamp>_add_marketing_consent_flag/migration.sql` and applies it to the local dev database (`DATABASE_URL` from `.env`). Prisma will also regenerate the client.

- [ ] **Step 3: Verify the generated SQL**

Read the new `migration.sql` file. Expected content (column order may differ slightly, that's fine — the statement itself must match):

```sql
ALTER TABLE "orders" ADD COLUMN "marketing_consent" BOOLEAN NOT NULL DEFAULT false;
```

If it differs meaningfully (e.g. targets the wrong table, wrong type, or a nullable column), stop and report — don't hand-edit a generated migration.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean (the regenerated Prisma client now types `marketingConsent` on `Order`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
feat: add marketingConsent column to Order

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `createOrder` accepts and stores consent

**Files:**
- Modify: `app/services/orders.server.ts:39-73`

- [ ] **Step 1: Update the function**

Replace the `createOrder` function in `app/services/orders.server.ts`:

```ts
export async function createOrder(input: { customerName: string; whatsapp: string; quantity: string; isRealTransaction?: boolean; filterPackageId?: number }, createdById: number) {
  const details = validateOrderInput(input);
  const price = Number(await getPricePerPrint());
  const snapshot = buildOrderSnapshot({ quantity: details.quantity, unitPrice: price, isRealTransaction: input.isRealTransaction !== false });
  const selectedPackage = input.filterPackageId
    ? (await getActiveFilterPackages()).find((filterPackage) => filterPackage.id === input.filterPackageId)
    : undefined;
  if (input.filterPackageId && !selectedPackage) throw new Error("Paket filter tidak ditemukan atau sudah nonaktif.");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => transaction.order.create({
        data: {
          code: generatePublicOrderCode(),
          customerName: details.customerName,
          whatsapp: details.whatsapp,
          quantity: details.quantity,
          unitPrice: snapshot.unitPrice,
          totalAmount: snapshot.totalAmount,
          isRealTransaction: snapshot.isRealTransaction,
          filterPackageId: selectedPackage?.id,
          paymentMethod: snapshot.paymentMethod,
          paymentStatus: snapshot.paymentStatus,
          status: snapshot.status,
          createdById,
          ...(selectedPackage ? { filterSnapshots: { create: selectedPackage.snapshots.map((filter) => ({ filterTemplateId: filter.filterId, filterName: filter.filterName, filterCss: filter.css, sortOrder: filter.sortOrder })) } } : {}),
        },
        include: { files: true, filterSnapshots: true },
      }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 4) throw error;
    }
  }
  throw new Error("Gagal membuat kode order unik.");
}
```

with this (adds `marketingConsent` to the input type and stores it):

```ts
export async function createOrder(input: { customerName: string; whatsapp: string; quantity: string; isRealTransaction?: boolean; marketingConsent?: boolean; filterPackageId?: number }, createdById: number) {
  const details = validateOrderInput(input);
  const price = Number(await getPricePerPrint());
  const snapshot = buildOrderSnapshot({ quantity: details.quantity, unitPrice: price, isRealTransaction: input.isRealTransaction !== false });
  const selectedPackage = input.filterPackageId
    ? (await getActiveFilterPackages()).find((filterPackage) => filterPackage.id === input.filterPackageId)
    : undefined;
  if (input.filterPackageId && !selectedPackage) throw new Error("Paket filter tidak ditemukan atau sudah nonaktif.");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => transaction.order.create({
        data: {
          code: generatePublicOrderCode(),
          customerName: details.customerName,
          whatsapp: details.whatsapp,
          quantity: details.quantity,
          unitPrice: snapshot.unitPrice,
          totalAmount: snapshot.totalAmount,
          isRealTransaction: snapshot.isRealTransaction,
          marketingConsent: input.marketingConsent === true,
          filterPackageId: selectedPackage?.id,
          paymentMethod: snapshot.paymentMethod,
          paymentStatus: snapshot.paymentStatus,
          status: snapshot.status,
          createdById,
          ...(selectedPackage ? { filterSnapshots: { create: selectedPackage.snapshots.map((filter) => ({ filterTemplateId: filter.filterId, filterName: filter.filterName, filterCss: filter.css, sortOrder: filter.sortOrder })) } } : {}),
        },
        include: { files: true, filterSnapshots: true },
      }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 4) throw error;
    }
  }
  throw new Error("Gagal membuat kode order unik.");
}
```

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npm run typecheck && npm test`
Expected: both clean. No dedicated test is added here — `createOrder` touches Prisma directly and this codebase has no DB-mocking convention (matches how `isRealTransaction` itself has no dedicated `createOrder` test; only pure helpers like `validateOrderInput` are unit-tested). Verification for this task is the full-suite regression plus Task 6's manual check.

- [ ] **Step 3: Commit**

```bash
git add app/services/orders.server.ts
git commit -m "$(cat <<'EOF'
feat: accept marketingConsent when creating an order

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Kasir checkbox

**Files:**
- Modify: `app/routes/admin.cashier.tsx`
- Test: `tests/public-order.test.ts` (extend)

- [ ] **Step 1: Write the failing content check**

In `tests/public-order.test.ts`, inside the existing `it("keeps file deletion and receipt printing on authenticated admin pages", ...)` test, find this existing line:

```ts
    expect(cashierPage).toContain('name="isRealTransaction"');
```

Add directly after it:

```ts
    expect(cashierPage).toContain('name="marketingConsent"');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- public-order`
Expected: FAIL — `admin.cashier.tsx` doesn't contain `name="marketingConsent"` yet.

- [ ] **Step 3: Wire up the checkbox**

In `app/routes/admin.cashier.tsx`, make four changes:

**(a)** In the `action` function, add a line right after the existing `isRealTransaction: formData.get('isRealTransaction') === 'on',` (line 40):

```ts
        isRealTransaction: formData.get('isRealTransaction') === 'on',
        marketingConsent: formData.get('marketingConsent') === 'on',
```

**(b)** In the `CashierPage` component, add state right after the existing `const [isRealTransaction, setIsRealTransaction] = useState(true);` (line 77):

```ts
  const [isRealTransaction, setIsRealTransaction] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
```

**(c)** Replace the existing reset effect:

```ts
  useEffect(() => {
    if (order?.code) setIsRealTransaction(true);
  }, [order?.code]);
```

with:

```ts
  useEffect(() => {
    if (order?.code) {
      setIsRealTransaction(true);
      setMarketingConsent(false);
    }
  }, [order?.code]);
```

**(d)** In the JSX, find the existing "Transaksi real" checkbox block:

```tsx
            <label className="flex items-center gap-3 self-end rounded-xl border border-[#e6ded2] p-4 sm:col-span-2">
              <input className="h-4 w-4 accent-[#25231f]" type="checkbox" name="isRealTransaction" checked={isRealTransaction} onChange={(event) => setIsRealTransaction(event.target.checked)} />
              <span><span className="block text-sm font-semibold">Transaksi real</span><span className="mt-1 block text-xs text-[#84796c]">Matikan untuk order test/free dan total menjadi Rp0.</span></span>
            </label>
```

Insert this new block directly ABOVE it (same grid, so it renders as its own full-width row above the "Transaksi real" row):

```tsx
            <label className="flex items-center gap-3 self-end rounded-xl border border-[#e6ded2] p-4 sm:col-span-2">
              <input className="h-4 w-4 accent-[#25231f]" type="checkbox" name="marketingConsent" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} />
              <span><span className="block text-sm font-semibold">Boleh di-share ke sosmed Poosefilm</span><span className="mt-1 block text-xs text-[#84796c]">Customer setuju fotonya dipakai untuk promosi di media sosial Poosefilm.</span></span>
            </label>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- public-order`
Expected: PASS

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin.cashier.tsx tests/public-order.test.ts
git commit -m "$(cat <<'EOF'
feat: add marketing consent checkbox to Kasir order form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Consent filter in the delivered-orders query

**Files:**
- Modify: `app/services/reports.server.ts`
- Test: `tests/history-export.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

In `tests/history-export.test.ts`, inside the existing `describe("delivered orders where-clause", () => { ... })` block, add a new test after the existing ones:

```ts
  it("adds a marketingConsent filter only when consentOnly is requested", () => {
    expect(buildDeliveredOrdersWhere("", undefined, true)).toEqual({
      status: "DELIVERED",
      marketingConsent: true,
    });
    expect(buildDeliveredOrdersWhere("", undefined, false)).toEqual({ status: "DELIVERED" });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- history-export`
Expected: FAIL — `buildDeliveredOrdersWhere` doesn't accept a third argument yet, and the actual `where` object won't have `marketingConsent`.

- [ ] **Step 3: Update the where-clause builder and `listDeliveredOrders`**

In `app/services/reports.server.ts`, replace:

```ts
export function buildDeliveredOrdersWhere(search: string, dateRange?: { start: Date; end: Date }) {
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
```

with:

```ts
export function buildDeliveredOrdersWhere(search: string, dateRange?: { start: Date; end: Date }, consentOnly?: boolean) {
  return {
    status: "DELIVERED" as const,
    ...(dateRange ? { createdAt: { gte: dateRange.start, lt: dateRange.end } } : {}),
    ...(consentOnly ? { marketingConsent: true } : {}),
    ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" as const } }, { customerName: { contains: search, mode: "insensitive" as const } }, { whatsapp: { contains: search } }] } : {}),
  };
}

export async function listDeliveredOrders(query: string, requestedPage = 1, pageSize = 12, consentOnly = false) {
  const where = buildDeliveredOrdersWhere(query.trim(), undefined, consentOnly);
  const total = await prisma.order.count({ where });
  const pagination = getHistoryPagination(requestedPage, pageSize, total);
  const orders = await prisma.order.findMany({ where, include: { _count: { select: { files: true } }, files: { include: { filterSnapshot: true, renderJob: { select: { status: true, lastError: true } } }, orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.pageSize });
  return { orders: orders.map((order) => ({ ...order, files: serializeOrderMedia(order.code, order.files) })), total, pagination };
}
```

Do not change `listDeliveredOrdersInRange` — the ZIP export feature is intentionally not consent-filtered (per spec).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- history-export`
Expected: PASS (all tests in this file, old + new).

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npm run typecheck && npm test`
Expected: both clean, no regressions in the other `buildDeliveredOrdersWhere`/`listDeliveredOrders` tests (they call with 1-2 args; the new third parameter is optional so those calls are unaffected).

- [ ] **Step 6: Commit**

```bash
git add app/services/reports.server.ts tests/history-export.test.ts
git commit -m "$(cat <<'EOF'
feat: add optional consent-only filter to listDeliveredOrders

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Riwayat filter checkbox

**Files:**
- Modify: `app/routes/admin.history.tsx`
- Test: `tests/public-order.test.ts` (extend)

- [ ] **Step 1: Write the failing content check**

In `tests/public-order.test.ts`, inside the same `it("keeps file deletion and receipt printing on authenticated admin pages", ...)` test used in Task 3, add one more assertion (anywhere after `historyPage` is read):

```ts
    expect(historyPage).toContain('name="consent"');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- public-order`
Expected: FAIL — `admin.history.tsx` doesn't contain `name="consent"` yet.

- [ ] **Step 3: Wire up the filter**

In `app/routes/admin.history.tsx`, make four changes:

**(a)** In the `loader`, replace:

```ts
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const history = await listDeliveredOrders(query, requestedPage, HISTORY_PAGE_SIZE);
```

with:

```ts
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const consentOnly = url.searchParams.get("consent") === "1";
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const history = await listDeliveredOrders(query, requestedPage, HISTORY_PAGE_SIZE, consentOnly);
```

**(b)** Replace `historyPageHref` so pagination links preserve the filter:

```ts
function historyPageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("page", String(page));
  return `?${params.toString()}`;
}
```

with:

```ts
function historyPageHref(query: string, page: number, consentOnly: boolean) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (consentOnly) params.set("consent", "1");
  params.set("page", String(page));
  return `?${params.toString()}`;
}
```

**(c)** In the `HistoryPage` component, add a line right after the existing `const query = searchParams.get("q") || "";`:

```ts
  const query = searchParams.get("q") || "";
  const consentOnly = searchParams.get("consent") === "1";
```

**(d)** Replace the search form:

```tsx
<Form method="get" className="flex gap-2"><input className="field-input min-w-64" name="q" defaultValue={query} placeholder="Cari nama, kode, nomor HP..." /><button className="button-secondary" type="submit">Cari</button></Form>
```

with:

```tsx
<Form method="get" className="flex flex-wrap items-center gap-2"><input className="field-input min-w-64" name="q" defaultValue={query} placeholder="Cari nama, kode, nomor HP..." /><label className="flex items-center gap-2 text-sm text-[#4a443d]"><input type="checkbox" name="consent" value="1" defaultChecked={consentOnly} className="h-4 w-4 accent-[#25231f]" />Boleh di-share aja</label><button className="button-secondary" type="submit">Cari</button></Form>
```

**(e)** Update both `historyPageHref` call sites (in the pagination `<nav>`) to pass `consentOnly` as the third argument: change `to={historyPageHref(query, pagination.page - 1)}` to `to={historyPageHref(query, pagination.page - 1, consentOnly)}`, and `to={historyPageHref(query, pagination.page + 1)}` to `to={historyPageHref(query, pagination.page + 1, consentOnly)}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- public-order`
Expected: PASS

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin.history.tsx tests/public-order.test.ts
git commit -m "$(cat <<'EOF'
feat: add consent-only filter checkbox to Riwayat page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Start the dev server and exercise the feature in a browser**

Run: `npm run dev:web` (or the project's existing dev server launch config)

In the browser:
1. Log in, go to `/admin/cashier`.
2. Confirm the new "Boleh di-share ke sosmed Poosefilm" checkbox appears directly above "Transaksi real", unchecked by default.
3. Create an order WITHOUT checking it. Create a second order WITH it checked.
4. Go to `/admin/history`. Confirm both orders can appear in the unfiltered list (after marking them delivered, if the page only shows `DELIVERED` orders — use whatever existing flow gets an order to `DELIVERED` status, e.g. the Antrian/queue page).
5. Check the new "Boleh di-share aja" checkbox next to search and click "Cari". Confirm only the second (consented) order appears.
6. Uncheck it and click "Cari" again. Confirm both orders reappear.
7. Confirm the existing date-range ZIP export controls on the same page are unaffected (still visible, still work) and that the ZIP export is NOT restricted by the consent filter (it should still include both orders' files if both are in the chosen date range).

- [ ] **Step 3: Stop the dev server**

No commit for this task — it's verification only.
