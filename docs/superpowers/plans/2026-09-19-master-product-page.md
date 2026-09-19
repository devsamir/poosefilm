# Master Product Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move product management to a dedicated superadmin page with search and filters, and flag every product as Print or Merch so the print counts stay correct once merch is sold.

**Architecture:** A `ProductKind` enum (`PRINT`, `MERCH`) on `Product`, snapshotted on `OrderItem` like name and price. A small shared util `app/utils/product-kind.ts` holds the kinds, labels, and pill styles for both server and client. The new page `/admin/products` filters on the server through URL params. Product management is removed from Settings at the end. Every task ends with a green typecheck and test run.

**Tech Stack:** Remix 2 (Vite), Prisma 5 + PostgreSQL, Vitest, Tailwind. Spec: `docs/superpowers/specs/2026-09-19-master-product-page-design.md` (builds on `2026-09-19-multi-product-orders-design.md`).

**Conventions to follow (from this codebase):**
- Tests are `tests/*.test.ts`, run with `npx vitest run`. No database tests; DB code is checked by pure-function tests, source-content tests (`readFileSync` + `toContain`), and a scratch-database check for migrations.
- User-facing strings are Indonesian. No emojis.
- Commit messages: `feat:` / `fix:` / `test:` / `docs:` prefixes, ending with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Work on branch `feat/multi-product-orders` (already checked out).
- Baseline before starting: `npm run typecheck` clean, `npx vitest run` shows 26 files / 99 tests passing.
- psql on Windows needs the connection URL as the LAST argument. Never print `.env` values or the derived URLs. Never touch the dev database `poosefilm`; use only `poosefilm_migtest` and `poosefilm_shadow`.

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/utils/product-kind.ts` | create | Kinds, labels, pill classes, `isProductKind` (server and client) |
| `prisma/schema.prisma` | modify | `ProductKind` enum, `Product.kind/description`, `OrderItem.productKind` |
| `prisma/migrations/20260919150000_add_product_kind_and_description/migration.sql` | create | Enum, product columns, order item snapshot column |
| `app/utils/order-items.ts` | modify | Snapshot carries `productKind`; `countPrintQuantity` |
| `app/services/products.server.ts` | modify | Serialize kind/description; validate input; `buildProductsWhere`, `searchProducts` |
| `app/components/ProductEditor.tsx` | modify | Kind select and description field |
| `app/services/reports.server.ts` | modify | `totalPrints` counts only `PRINT` items |
| `app/routes/admin.cashier.tsx` | modify | Kind tag per product, print-only footer count |
| `app/routes/admin.products.tsx` | create | The new master product page |
| `app/components/AccountMenu.tsx` | modify | "Produk" link for superadmin |
| `app/routes/admin.settings.tsx` | modify | Remove the product section and intents |
| `README.md` | modify | Describe the Produk page |
| `tests/product-kind.test.ts`, `tests/product-filters.test.ts` | create | New pure tests |
| `tests/product-schema.test.ts`, `tests/order-items.test.ts`, `tests/products.test.ts`, `tests/product-ui.test.ts` | modify | Extend and adapt |

---

### Task 1: Product kind through the data layer

Adds the enum, the columns, the snapshot, and the shared util. Existing screens keep working because `Product.kind` defaults to `PRINT`.

**Files:**
- Create: `tests/product-kind.test.ts`, `app/utils/product-kind.ts`
- Create: `prisma/migrations/20260919150000_add_product_kind_and_description/migration.sql`
- Modify: `prisma/schema.prisma`, `app/utils/order-items.ts`, `app/services/products.server.ts`
- Modify: `tests/product-schema.test.ts`, `tests/order-items.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/product-kind.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { PRODUCT_KINDS, PRODUCT_KIND_LABELS, PRODUCT_KIND_PILL_CLASSES, isProductKind } from "~/utils/product-kind";

describe("product kind", () => {
  it("knows the two kinds with a label and pill style for each", () => {
    expect(PRODUCT_KINDS).toEqual(["PRINT", "MERCH"]);
    expect(PRODUCT_KIND_LABELS).toEqual({ PRINT: "Cetak", MERCH: "Merch" });
    expect(Object.keys(PRODUCT_KIND_PILL_CLASSES)).toEqual(["PRINT", "MERCH"]);
  });

  it("recognises only valid kinds", () => {
    expect(isProductKind("PRINT")).toBe(true);
    expect(isProductKind("MERCH")).toBe(true);
    expect(isProductKind("ALL")).toBe(false);
    expect(isProductKind("print")).toBe(false);
    expect(isProductKind("")).toBe(false);
    expect(isProductKind(undefined)).toBe(false);
  });
});
```

Append inside the `describe("multi-product schema", ...)` block of `tests/product-schema.test.ts`:

```ts
  it("flags products as print or merch and snapshots the kind on order items", () => {
    const productModel = schema.match(/model Product \{[\s\S]*?\n\}/)?.[0] ?? "";
    const itemModel = schema.match(/model OrderItem \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(schema).toContain("enum ProductKind");
    expect(productModel).toContain("kind");
    expect(productModel).toContain("description");
    expect(itemModel).toMatch(/productKind\s+ProductKind\s+@map\("product_kind"\)\s*\n/);
  });
```

In `tests/order-items.test.ts` change the import line to

```ts
import { calculateOrderTotal, countPrintQuantity, parseOrderItemFields, resolveOrderItems, validateOrderItems } from "~/utils/order-items";
```

and replace the whole `describe("resolveOrderItems", ...)` block with:

```ts
describe("resolveOrderItems", () => {
  const products = [
    { id: 1, name: "Strip 2 pose", price: 50000, kind: "PRINT" as const, isActive: true },
    { id: 2, name: "Cabinet", price: 95000, kind: "PRINT" as const, isActive: true },
    { id: 3, name: "Lama", price: 10000, kind: "PRINT" as const, isActive: false },
    { id: 4, name: "Kaos", price: 120000, kind: "MERCH" as const, isActive: true },
  ];

  it("snapshots the current name, kind, and price of each product", () => {
    expect(resolveOrderItems([{ productId: 2, quantity: 3 }], products)).toEqual([{ productId: 2, productName: "Cabinet", productKind: "PRINT", unitPrice: 95000, quantity: 3 }]);
    expect(resolveOrderItems([{ productId: 4, quantity: 1 }], products)).toEqual([{ productId: 4, productName: "Kaos", productKind: "MERCH", unitPrice: 120000, quantity: 1 }]);
  });

  it("rejects a missing or inactive product", () => {
    expect(() => resolveOrderItems([{ productId: 99, quantity: 1 }], products)).toThrow("Product tidak ditemukan atau sudah nonaktif.");
    expect(() => resolveOrderItems([{ productId: 3, quantity: 1 }], products)).toThrow("Product tidak ditemukan atau sudah nonaktif.");
  });
});

describe("countPrintQuantity", () => {
  it("counts only print items", () => {
    const items = [{ productKind: "PRINT" as const, quantity: 3 }, { productKind: "MERCH" as const, quantity: 2 }, { productKind: "PRINT" as const, quantity: 1 }];
    expect(countPrintQuantity(items)).toBe(4);
  });

  it("is zero when every item is merch or there are no items", () => {
    expect(countPrintQuantity([{ productKind: "MERCH" as const, quantity: 5 }])).toBe(0);
    expect(countPrintQuantity([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-kind.test.ts tests/product-schema.test.ts tests/order-items.test.ts`
Expected: FAIL (cannot resolve `~/utils/product-kind`, missing `enum ProductKind`, missing `countPrintQuantity`).

- [ ] **Step 3: Create the shared util**

Create `app/utils/product-kind.ts`:

```ts
export const PRODUCT_KINDS = ["PRINT", "MERCH"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = { PRINT: "Cetak", MERCH: "Merch" };

export const PRODUCT_KIND_PILL_CLASSES: Record<ProductKind, string> = {
  PRINT: "bg-[#f1ede6] text-[#62594f]",
  MERCH: "bg-sky-50 text-sky-700",
};

export function isProductKind(value: unknown): value is ProductKind {
  return PRODUCT_KINDS.includes(value as ProductKind);
}
```

- [ ] **Step 4: Update the schema**

In `prisma/schema.prisma` replace the whole `model Product { ... }` block with:

```prisma
enum ProductKind {
  PRINT
  MERCH
}

model Product {
  id          Int         @id @default(autoincrement())
  name        String      @unique
  price       Decimal     @db.Decimal(12, 2)
  kind        ProductKind @default(PRINT)
  description String?
  isActive    Boolean     @default(true) @map("is_active")
  items       OrderItem[]
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  @@map("products")
}
```

and replace the whole `model OrderItem { ... }` block with:

```prisma
model OrderItem {
  id          Int         @id @default(autoincrement())
  orderId     Int         @map("order_id")
  productId   Int         @map("product_id")
  productName String      @map("product_name")
  productKind ProductKind @map("product_kind")
  unitPrice   Decimal     @map("unit_price") @db.Decimal(12, 2)
  quantity    Int
  order       Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product     @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([orderId, productId])
  @@map("order_items")
}
```

- [ ] **Step 5: Create the migration**

Create `prisma/migrations/20260919150000_add_product_kind_and_description/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PRINT', 'MERCH');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "description" TEXT,
ADD COLUMN     "kind" "ProductKind" NOT NULL DEFAULT 'PRINT';

-- AlterTable: every existing order item was a print; the default is dropped so new code must set the kind
ALTER TABLE "order_items" ADD COLUMN     "product_kind" "ProductKind" NOT NULL DEFAULT 'PRINT';
ALTER TABLE "order_items" ALTER COLUMN "product_kind" DROP DEFAULT;
```

- [ ] **Step 6: Update `app/utils/order-items.ts`**

Add an import at the top of the file:

```ts
import type { ProductKind } from "~/utils/product-kind";
```

Replace

```ts
export type ProductSnapshotSource = { id: number; name: string; price: number; isActive: boolean };
```

with

```ts
export type ProductSnapshotSource = { id: number; name: string; price: number; kind: ProductKind; isActive: boolean };
```

Replace the docstring and return line inside `resolveOrderItems`:

```ts
/** Copies the current name, kind, and price of each requested product so later edits never change the order. */
```

and

```ts
    return { productId: product.id, productName: product.name, productKind: product.kind, unitPrice: product.price, quantity: item.quantity };
```

Append at the end of the file:

```ts
export function countPrintQuantity(items: { productKind: ProductKind; quantity: number }[]) {
  return items.reduce((sum, item) => (item.productKind === "PRINT" ? sum + item.quantity : sum), 0);
}
```

- [ ] **Step 7: Serialize kind and description in `app/services/products.server.ts`**

Add an import below the prisma import:

```ts
import type { ProductKind } from "~/utils/product-kind";
```

Replace `serializeProduct` with:

```ts
function serializeProduct(product: { id: number; name: string; price: Prisma.Decimal; kind: ProductKind; description: string | null; isActive: boolean }) {
  return { id: product.id, name: product.name, price: Number(product.price), kind: product.kind, description: product.description, isActive: product.isActive };
}
```

- [ ] **Step 8: Regenerate the client, run tests, typecheck**

Stop any running dev server first (Windows locks the Prisma engine file).

Run: `npx prisma validate && npx prisma generate && npx vitest run && npm run typecheck`
Expected: schema valid, client generated, all tests pass (the new tests included), typecheck clean.

- [ ] **Step 9: Verify the migration on a scratch database**

```bash
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\r')
SCRATCH_URL=$(echo "$DB_URL" | sed -E 's#/poosefilm(\?.*)?$#/poosefilm_migtest\1#')
SHADOW_URL=$(echo "$DB_URL" | sed -E 's#/poosefilm(\?.*)?$#/poosefilm_shadow\1#')
case "$SCRATCH_URL" in *poosefilm_migtest*) ;; *) echo "bad scratch url"; exit 1;; esac
case "$SHADOW_URL" in *poosefilm_shadow*) ;; *) echo "bad shadow url"; exit 1;; esac
psql -c 'DROP DATABASE IF EXISTS poosefilm_migtest' -c 'CREATE DATABASE poosefilm_migtest' -c 'DROP DATABASE IF EXISTS poosefilm_shadow' -c 'CREATE DATABASE poosefilm_shadow' "$DB_URL"
for d in $(ls -d prisma/migrations/*/ | grep -v add_product_kind_and_description); do psql -v ON_ERROR_STOP=1 -q -f "${d}migration.sql" "$SCRATCH_URL"; done
psql -v ON_ERROR_STOP=1 -q "$SCRATCH_URL" <<'SQL'
INSERT INTO users (name, email, password_hash, updated_at) VALUES ('T', 't@t.id', 'x', now());
INSERT INTO orders (code, customer_name, whatsapp, total_amount, payment_method, payment_status, created_by_id, updated_at)
VALUES ('T1', 'A', '08111', 190000, 'CASH', 'PAID', 1, now());
INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
SELECT o.id, p.id, p.name, 95000, 2 FROM orders o CROSS JOIN products p WHERE o.code = 'T1' ORDER BY p.id LIMIT 1;
SQL
psql -v ON_ERROR_STOP=1 -q -f prisma/migrations/20260919150000_add_product_kind_and_description/migration.sql "$SCRATCH_URL"
psql -c "SELECT name, kind, description FROM products" -c "SELECT product_name, product_kind, quantity FROM order_items" -c "\d order_items" "$SCRATCH_URL"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --exit-code
```

Expected: `products` shows `Cetak | PRINT | (null)`; `order_items` shows the one row with `PRINT`; `\d order_items` shows `product_kind` as `not null` with no default; the diff command exits 0 with `No difference detected.` If it prints a diff, fix `migration.sql` (not the schema) until clean. Do not print the URL variables.

- [ ] **Step 10: Commit**

```bash
git add app/utils/product-kind.ts app/utils/order-items.ts app/services/products.server.ts prisma/schema.prisma prisma/migrations/20260919150000_add_product_kind_and_description tests/product-kind.test.ts tests/product-schema.test.ts tests/order-items.test.ts
git commit -m "feat: add product kind and snapshot it on order items" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Kind and description in product input and editor

**Files:**
- Modify: `tests/products.test.ts`, `tests/product-ui.test.ts`
- Modify: `app/services/products.server.ts`, `app/components/ProductEditor.tsx`, `app/routes/admin.settings.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the whole content of `tests/products.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { normalizeProductInput, validateProductPrice } from "~/services/products.server";

describe("product validation", () => {
  it("accepts only positive integer prices", () => {
    expect(validateProductPrice("95000")).toBe(95000);
    expect(() => validateProductPrice("0")).toThrow();
    expect(() => validateProductPrice("95000.5")).toThrow();
    expect(() => validateProductPrice("")).toThrow();
  });

  it("trims the name and description, converts the price, and defaults to active", () => {
    expect(normalizeProductInput({ name: "  Strip 2 pose ", price: "50000", kind: "PRINT", description: "  Dua pose  " })).toEqual({ name: "Strip 2 pose", price: 50000, kind: "PRINT", description: "Dua pose", isActive: true });
    expect(normalizeProductInput({ name: "Kaos", price: "120000", kind: "MERCH", isActive: false })).toEqual({ name: "Kaos", price: 120000, kind: "MERCH", description: null, isActive: false });
  });

  it("turns a blank description into null", () => {
    expect(normalizeProductInput({ name: "Kaos", price: "120000", kind: "MERCH", description: "   " }).description).toBeNull();
  });

  it("requires a name", () => {
    expect(() => normalizeProductInput({ name: "   ", price: "50000", kind: "PRINT" })).toThrow("Nama wajib diisi.");
  });

  it("rejects an unknown or missing kind", () => {
    expect(() => normalizeProductInput({ name: "X", price: "1000", kind: "SERVICE" })).toThrow("Tipe product tidak valid.");
    expect(() => normalizeProductInput({ name: "X", price: "1000", kind: "" })).toThrow("Tipe product tidak valid.");
  });

  it("limits the description to 255 characters", () => {
    expect(normalizeProductInput({ name: "X", price: "1000", kind: "PRINT", description: "a".repeat(255) }).description).toHaveLength(255);
    expect(() => normalizeProductInput({ name: "X", price: "1000", kind: "PRINT", description: "a".repeat(256) })).toThrow("Keterangan maksimal 255 karakter.");
  });
});
```

In `tests/product-ui.test.ts`, replace the test `submits the product fields from the editor form` with:

```ts
  it("submits the product fields from the editor form", () => {
    const editor = source("app/components/ProductEditor.tsx");
    expect(editor).toContain('name="isActive"');
    expect(editor).toContain('name="price"');
    expect(editor).toContain('name="kind"');
    expect(editor).toContain('name="description"');
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/products.test.ts tests/product-ui.test.ts`
Expected: FAIL (`kind` not validated, editor lacks `name="kind"`).

- [ ] **Step 3: Update `app/services/products.server.ts`**

Replace the import added in Task 1

```ts
import type { ProductKind } from "~/utils/product-kind";
```

with

```ts
import { isProductKind, type ProductKind } from "~/utils/product-kind";
```

Replace the `ProductInput` type line with:

```ts
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 255;

export type ProductInput = { name: string; price: string; kind: string; description?: string; isActive?: boolean };
```

Replace `normalizeProductInput` with:

```ts
export function normalizeProductInput(input: ProductInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Nama wajib diisi.");
  if (!isProductKind(input.kind)) throw new Error("Tipe product tidak valid.");
  const description = (input.description ?? "").trim();
  if (description.length > PRODUCT_DESCRIPTION_MAX_LENGTH) throw new Error(`Keterangan maksimal ${PRODUCT_DESCRIPTION_MAX_LENGTH} karakter.`);
  return { name, price: validateProductPrice(input.price), kind: input.kind, description: description || null, isActive: input.isActive ?? true };
}
```

- [ ] **Step 4: Replace `app/components/ProductEditor.tsx`**

```tsx
import { Form } from "@remix-run/react";

import { PRODUCT_KINDS, PRODUCT_KIND_LABELS, type ProductKind } from "~/utils/product-kind";

type ProductData = { id: number; name: string; price: number; kind: ProductKind; description: string | null; isActive: boolean };

export function ProductEditor({ intent, product, submitLabel }: { intent: "product-create" | "product-update"; product?: ProductData; submitLabel: string }) {
  return (
    <Form method="post" className="space-y-4 rounded-xl border border-[#eee7df] p-4">
      <input type="hidden" name="intent" value={intent} />
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <label className="field-label">Nama product<input className="field-input" name="name" defaultValue={product?.name || ""} required autoFocus /></label>
      <label className="field-label">Tipe<select className="field-input" name="kind" defaultValue={product?.kind ?? "PRINT"}>{PRODUCT_KINDS.map((kind) => <option key={kind} value={kind}>{PRODUCT_KIND_LABELS[kind]}</option>)}</select></label>
      <label className="field-label">Harga dalam Rupiah<input className="field-input" type="number" name="price" min="1" step="1" defaultValue={product?.price} required /></label>
      <label className="field-label">Keterangan (opsional)<textarea className="field-input resize-y" name="description" defaultValue={product?.description ?? ""} rows={3} maxLength={255} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} />Aktif (tampil di kasir)</label>
      <button className="button-secondary text-xs" type="submit">{submitLabel}</button>
    </Form>
  );
}
```

- [ ] **Step 5: Pass the new fields from the Settings action**

In `app/routes/admin.settings.tsx` replace

```tsx
      const input = { name: String(formData.get("name") || ""), price: String(formData.get("price") || ""), isActive: formData.get("isActive") === "on" };
```

with

```tsx
      const input = { name: String(formData.get("name") || ""), price: String(formData.get("price") || ""), kind: String(formData.get("kind") || ""), description: String(formData.get("description") || ""), isActive: formData.get("isActive") === "on" };
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add app/services/products.server.ts app/components/ProductEditor.tsx app/routes/admin.settings.tsx tests/products.test.ts tests/product-ui.test.ts
git commit -m "feat: validate product kind and description and add them to the editor" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Print-only counts in Rekap and the cashier

**Files:**
- Modify: `tests/product-ui.test.ts`
- Modify: `app/services/reports.server.ts`, `app/routes/admin.cashier.tsx`

- [ ] **Step 1: Write the failing tests**

In `tests/product-ui.test.ts` replace the test `aggregates item quantities of real orders only` with:

```ts
  it("aggregates print item quantities of real orders only", () => {
    const reports = source("app/services/reports.server.ts");
    expect(reports).toContain("prisma.orderItem.aggregate");
    expect(reports).toContain("isRealTransaction: true");
    expect(reports).toContain('productKind: "PRINT"');
    expect(reports).not.toContain("_sum: { quantity: true, totalAmount: true }");
  });
```

and add this test inside `describe("cashier and receipt use product items", ...)`:

```ts
  it("tags each product with its kind and counts only prints in the footer", () => {
    const cashier = source("app/routes/admin.cashier.tsx");
    expect(cashier).toContain("countPrintQuantity");
    expect(cashier).toContain("PRODUCT_KIND_LABELS[product.kind]");
    expect(cashier).toContain("halaman Produk");
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-ui.test.ts`
Expected: FAIL (`productKind: "PRINT"` missing, `countPrintQuantity` missing).

- [ ] **Step 3: Update `app/services/reports.server.ts`**

Replace

```ts
    prisma.orderItem.aggregate({ where: { order: realWhere }, _sum: { quantity: true } }),
```

with

```ts
    prisma.orderItem.aggregate({ where: { productKind: "PRINT", order: realWhere }, _sum: { quantity: true } }),
```

- [ ] **Step 4: Update `app/routes/admin.cashier.tsx`**

4a. Imports. Replace

```tsx
import { calculateOrderTotal, parseOrderItemFields } from '~/utils/order-items';
```

with

```tsx
import { calculateOrderTotal, countPrintQuantity, parseOrderItemFields } from '~/utils/order-items';
import { PRODUCT_KIND_LABELS, PRODUCT_KIND_PILL_CLASSES } from '~/utils/product-kind';
```

4b. Items and counts. Replace

```tsx
  const items = products.map((product) => ({
    unitPrice: product.price,
    quantity: quantities[product.id] || 0,
  }));
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
```

with

```tsx
  const items = products.map((product) => ({
    unitPrice: product.price,
    quantity: quantities[product.id] || 0,
    productKind: product.kind,
  }));
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const printQuantity = countPrintQuantity(items);
```

4c. Kind tag beside the product name. Replace

```tsx
                        <p className="text-sm font-semibold">{product.name}</p>
```

with

```tsx
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {product.name}
                          <span className={`status-pill ${PRODUCT_KIND_PILL_CLASSES[product.kind]}`}>
                            {PRODUCT_KIND_LABELS[product.kind]}
                          </span>
                        </p>
```

4d. Footer count. Replace

```tsx
                {totalQuantity} cetak
```

with

```tsx
                {printQuantity} cetak
```

4e. Empty-catalog hint. Replace

```tsx
                  Belum ada product aktif. Minta superadmin menambahkannya di Settings.
```

with

```tsx
                  Belum ada product aktif. Minta superadmin menambahkannya di halaman Produk.
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all pass, typecheck clean. `npx eslint --ext .ts,.tsx app/routes/admin.cashier.tsx app/services/reports.server.ts` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add app/services/reports.server.ts app/routes/admin.cashier.tsx tests/product-ui.test.ts
git commit -m "feat: count only print items in Rekap and show product kind at the cashier" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Product filters (service)

**Files:**
- Create: `tests/product-filters.test.ts`
- Modify: `app/services/products.server.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/product-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildProductsWhere } from "~/services/products.server";

describe("buildProductsWhere", () => {
  it("returns no conditions when nothing is filtered", () => {
    expect(buildProductsWhere({ q: "", kind: "", status: "" })).toEqual({});
  });

  it("searches name and description case-insensitively and trims the term", () => {
    expect(buildProductsWhere({ q: "  polaroid ", kind: "", status: "" })).toEqual({
      OR: [
        { name: { contains: "polaroid", mode: "insensitive" } },
        { description: { contains: "polaroid", mode: "insensitive" } },
      ],
    });
  });

  it("filters by kind and ignores unknown kinds", () => {
    expect(buildProductsWhere({ q: "", kind: "MERCH", status: "" })).toEqual({ kind: "MERCH" });
    expect(buildProductsWhere({ q: "", kind: "ALL", status: "" })).toEqual({});
    expect(buildProductsWhere({ q: "", kind: "merch", status: "" })).toEqual({});
  });

  it("filters by status and ignores unknown statuses", () => {
    expect(buildProductsWhere({ q: "", kind: "", status: "ACTIVE" })).toEqual({ isActive: true });
    expect(buildProductsWhere({ q: "", kind: "", status: "INACTIVE" })).toEqual({ isActive: false });
    expect(buildProductsWhere({ q: "", kind: "", status: "ALL" })).toEqual({});
  });

  it("combines every filter", () => {
    expect(buildProductsWhere({ q: "kaos", kind: "MERCH", status: "ACTIVE" })).toEqual({
      OR: [
        { name: { contains: "kaos", mode: "insensitive" } },
        { description: { contains: "kaos", mode: "insensitive" } },
      ],
      kind: "MERCH",
      isActive: true,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-filters.test.ts`
Expected: FAIL, `buildProductsWhere` is not exported.

- [ ] **Step 3: Implement in `app/services/products.server.ts`**

Add after `listActiveProducts`:

```ts
export type ProductFilters = { q: string; kind: string; status: string };

/** Builds the Prisma where for the master list; an unknown kind or status means no filter. */
export function buildProductsWhere({ q, kind, status }: ProductFilters) {
  const search = q.trim();
  return {
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { description: { contains: search, mode: "insensitive" as const } }] } : {}),
    ...(isProductKind(kind) ? { kind } : {}),
    ...(status === "ACTIVE" ? { isActive: true } : status === "INACTIVE" ? { isActive: false } : {}),
  };
}

export async function searchProducts(filters: ProductFilters) {
  const products = await prisma.product.findMany({ where: buildProductsWhere(filters), orderBy: { name: "asc" } });
  return products.map(serializeProduct);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add app/services/products.server.ts tests/product-filters.test.ts
git commit -m "feat: add product search and filter query" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: The Produk page and its menu link

While Settings still has its own product section (removed in Task 6), both places work.

**Files:**
- Modify: `tests/product-ui.test.ts`
- Create: `app/routes/admin.products.tsx`
- Modify: `app/components/AccountMenu.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/product-ui.test.ts`:

```ts
describe("dedicated master product page", () => {
  it("is superadmin-only and offers search, type, and status filters", () => {
    const page = source("app/routes/admin.products.tsx");
    expect(page).toContain("requireSuperadmin");
    expect(page).toContain("searchProducts");
    expect(page).toContain('name="q"');
    expect(page).toContain('name="type"');
    expect(page).toContain('name="status"');
  });

  it("creates, updates, and toggles products from the table", () => {
    const page = source("app/routes/admin.products.tsx");
    expect(page).toContain('"product-create"');
    expect(page).toContain('"product-update"');
    expect(page).toContain('"product-toggle"');
    expect(page).toContain("ProductEditor");
    expect(page).toContain("+ Tambah product");
  });

  it("is reachable from the superadmin account menu", () => {
    const menu = source("app/components/AccountMenu.tsx");
    expect(menu).toContain("/admin/products");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-ui.test.ts`
Expected: FAIL, `app/routes/admin.products.tsx` does not exist and the menu has no link.

- [ ] **Step 3: Create `app/routes/admin.products.tsx`**

```tsx
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState, type ChangeEvent } from "react";

import { ProductEditor } from "~/components/ProductEditor";
import { SettingsModal } from "~/components/SettingsModal";
import { requireSuperadmin } from "~/services/auth.server";
import { createProduct, searchProducts, setProductActive, updateProduct } from "~/services/products.server";
import { PRODUCT_KINDS, PRODUCT_KIND_LABELS, PRODUCT_KIND_PILL_CLASSES, isProductKind } from "~/utils/product-kind";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperadmin(request);
  const params = new URL(request.url).searchParams;
  const filters = { q: params.get("q") || "", kind: params.get("type") || "", status: params.get("status") || "" };
  return json({ products: await searchProducts(filters), filters });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperadmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  try {
    if (intent === "product-create" || intent === "product-update") {
      const input = { name: String(formData.get("name") || ""), price: String(formData.get("price") || ""), kind: String(formData.get("kind") || ""), description: String(formData.get("description") || ""), isActive: formData.get("isActive") === "on" };
      if (intent === "product-create") await createProduct(input);
      else await updateProduct(Number(formData.get("id")), input);
      return json({ success: "Product berhasil disimpan." });
    }
    if (intent === "product-toggle") {
      const isActive = formData.get("isActive") === "true";
      await setProductActive(Number(formData.get("id")), isActive);
      return json({ success: isActive ? "Product diaktifkan." : "Product dinonaktifkan." });
    }
    return json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menyimpan product." }, { status: 400 });
  }
}

const currencyFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function submitOnChange(event: ChangeEvent<HTMLSelectElement>) {
  event.currentTarget.form?.requestSubmit();
}

export default function ProductsPage() {
  const { products, filters } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [modal, setModal] = useState<{ id?: number } | null>(null);
  const error = actionData && "error" in actionData ? actionData.error : null;
  const success = actionData && "success" in actionData ? actionData.success : null;
  const hasFilters = Boolean(filters.q.trim()) || isProductKind(filters.kind) || filters.status === "ACTIVE" || filters.status === "INACTIVE";
  const selectedProduct = modal?.id ? products.find((product) => product.id === modal.id) : undefined;

  useEffect(() => {
    if (success) setModal(null);
  }, [actionData]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">SUPERADMIN AREA</p><h1 className="page-title">Produk</h1><p className="page-subtitle">Kelola product cetak dan merch yang dijual di kasir.</p></div>
      <button className="button-primary" type="button" onClick={() => setModal({})}>+ Tambah product</button>
    </div>
    {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p> : null}
    {success ? <p className="rounded-2xl border border-[#d8e0d5] bg-[#f1f6ef] p-4 text-sm text-[#4e684d]" role="status">{success}</p> : null}

    <Form method="get" key={`${filters.q}|${filters.kind}|${filters.status}`} className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e6ded2] bg-white p-4">
      <label className="field-label min-w-64 flex-1">Cari<input className="field-input" name="q" defaultValue={filters.q} placeholder="Cari nama atau keterangan..." /></label>
      <label className="field-label">Tipe<select className="field-input" name="type" defaultValue={filters.kind} onChange={submitOnChange}><option value="">Semua</option>{PRODUCT_KINDS.map((kind) => <option key={kind} value={kind}>{PRODUCT_KIND_LABELS[kind]}</option>)}</select></label>
      <label className="field-label">Status<select className="field-input" name="status" defaultValue={filters.status} onChange={submitOnChange}><option value="">Semua</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></label>
      <button className="button-secondary" type="submit">Cari</button>
      {hasFilters ? <Link className="button-secondary" to="/admin/products">Reset</Link> : null}
    </Form>

    <p className="text-sm text-[#84796c]">{products.length} product</p>

    {products.length ? <div className="overflow-x-auto rounded-2xl border border-[#e6ded2] bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[#eee7df] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a09587]"><tr><th className="px-5 py-3">Nama</th><th className="px-5 py-3">Tipe</th><th className="px-5 py-3 text-right">Harga</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead>
        <tbody className="divide-y divide-[#eee7df]">
          {products.map((product) => <tr key={product.id}>
            <td className="px-5 py-4"><p className="font-semibold text-[#1f2528]">{product.name}</p>{product.description ? <p className="mt-1 max-w-md text-xs text-[#84796c]">{product.description}</p> : null}</td>
            <td className="px-5 py-4"><span className={`status-pill ${PRODUCT_KIND_PILL_CLASSES[product.kind]}`}>{PRODUCT_KIND_LABELS[product.kind]}</span></td>
            <td className="px-5 py-4 text-right">{currencyFormatter.format(product.price)}</td>
            <td className="px-5 py-4"><span className={`status-pill ${product.isActive ? "status-ready" : "status-waiting"}`}>{product.isActive ? "Aktif" : "Nonaktif"}</span></td>
            <td className="px-5 py-4"><div className="flex items-center justify-end gap-4"><button className="settings-action" type="button" onClick={() => setModal({ id: product.id })}>Edit</button><Form method="post"><input type="hidden" name="intent" value="product-toggle" /><input type="hidden" name="id" value={product.id} /><input type="hidden" name="isActive" value={String(!product.isActive)} /><button className={`text-xs font-semibold ${product.isActive ? "text-[#a34e43]" : "text-[#4e684d]"}`} type="submit">{product.isActive ? "Nonaktifkan" : "Aktifkan"}</button></Form></div></td>
          </tr>)}
        </tbody>
      </table>
    </div> : <div className="empty-library"><p>{hasFilters ? "Tidak ada product yang cocok dengan filter." : "Belum ada product."}</p>{hasFilters ? null : <button className="settings-action mt-2" type="button" onClick={() => setModal({})}>Buat product pertama</button>}</div>}

    {modal ? <SettingsModal open title={selectedProduct ? `Edit ${selectedProduct.name}` : "Tambah product"} description="Product nonaktif tidak muncul di kasir, tapi order lama tetap menyimpan nama, tipe, dan harganya." onClose={() => setModal(null)}><ProductEditor key={selectedProduct?.id || "new-product"} intent={selectedProduct ? "product-update" : "product-create"} product={selectedProduct} submitLabel={selectedProduct ? "Simpan perubahan" : "Simpan product"} /></SettingsModal> : null}
  </div>;
}
```

- [ ] **Step 4: Add the menu link in `app/components/AccountMenu.tsx`**

Replace

```tsx
          <Link className="menu-link" to="/admin/settings">Settings</Link>
```

with

```tsx
          <Link className="menu-link" to="/admin/products">Produk</Link>
          <Link className="menu-link" to="/admin/settings">Settings</Link>
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npx eslint --ext .ts,.tsx app/routes/admin.products.tsx app/components/AccountMenu.tsx`
Expected: all pass, typecheck clean, eslint prints nothing.

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin.products.tsx app/components/AccountMenu.tsx tests/product-ui.test.ts
git commit -m "feat: add the dedicated Produk page with search and filters" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Remove product management from Settings

**Files:**
- Modify: `tests/product-ui.test.ts`
- Modify: `app/routes/admin.settings.tsx`, `README.md`

- [ ] **Step 1: Update the tests**

In `tests/product-ui.test.ts` delete the two tests that read `app/routes/admin.settings.tsx` for products: `lets superadmin manage the product master from Settings` and `toggles a product active or inactive straight from its card`. Keep `submits the product fields from the editor form` in that describe. Append:

```ts
describe("Settings no longer manages products", () => {
  it("keeps the product master on its own page", () => {
    const settings = source("app/routes/admin.settings.tsx");
    expect(settings).toContain("requireSuperadmin");
    expect(settings).not.toContain('data-testid="product-library"');
    expect(settings).not.toContain("ProductEditor");
    expect(settings).not.toContain("products.server");
    expect(settings).not.toContain('"product-toggle"');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-ui.test.ts`
Expected: FAIL on the new describe (Settings still has the product section).

- [ ] **Step 3: Remove the product code from `app/routes/admin.settings.tsx`**

Apply these edits (use Read and Edit; the section and modal lines are long, so match them by their start and end):

1. Delete the line `import { ProductEditor } from "~/components/ProductEditor";`.
2. Delete the line `import { createProduct, listProducts, setProductActive, updateProduct } from "~/services/products.server";`.
3. Loader: replace

```tsx
  const [whatsappTemplate, filters, packages, products] = await Promise.all([getWhatsappTemplate(), listFilterTemplates(), listFilterPackages(), listProducts()]);
  return json({ whatsappTemplate, filters, packages, products });
```

with

```tsx
  const [whatsappTemplate, filters, packages] = await Promise.all([getWhatsappTemplate(), listFilterTemplates(), listFilterPackages()]);
  return json({ whatsappTemplate, filters, packages });
```

4. Action: delete the two blocks `if (intent === "product-create" || intent === "product-update") { ... }` and `if (intent === "product-toggle") { ... }` (from the first `if` line through the closing brace of the toggle block), so `package-delete` is followed directly by `return json({ error: "Aksi tidak dikenal." }, { status: 400 });`.
5. Modal state type: replace

```tsx
  | { type: "package"; id?: number }
  | { type: "product"; id?: number };
```

with

```tsx
  | { type: "package"; id?: number };
```

6. Delete the line `const currencyFormatter = new Intl.NumberFormat("id-ID", ...);` (it was only used by the product cards) and its trailing blank line.
7. Component: replace `const { whatsappTemplate, filters, packages, products } = useLoaderData<typeof loader>();` with `const { whatsappTemplate, filters, packages } = useLoaderData<typeof loader>();` and delete the line starting `const selectedProduct = modal?.type === "product"`.
8. Delete the whole product section: from the line `<section className="settings-section" data-testid="product-library">` through its closing `</section>` and the blank line after it.
9. Delete the line starting `{modal?.type === "product" ? <SettingsModal`.
10. Header subtitle: replace `Atur product, pesan customer, dan resep visual untuk hasil foto Poosefilm.` with `Atur pesan customer dan resep visual untuk hasil foto Poosefilm.`

- [ ] **Step 4: Update `README.md`**

Replace the line

```
- `Settings` (SUPERADMIN only): manage products (name, price), WhatsApp template, filter masters, and filter packages.
```

with

```
- `Produk` (SUPERADMIN only, account menu): manage the product master (print or merch, price, active) with search and filters.
- `Settings` (SUPERADMIN only): manage the WhatsApp template, filter masters, and filter packages.
```

- [ ] **Step 5: Run everything**

Run: `npx vitest run && npm run typecheck && npx eslint --ext .ts,.tsx app tests`
Expected: all pass, typecheck clean, 0 eslint errors (the 2 pre-existing warnings in `WebcamRecorder.tsx` and `admin.tsx` are fine). Confirm no unused-variable warning was introduced in `admin.settings.tsx` (for example `Form` is still used by the filter and package delete forms).

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin.settings.tsx README.md tests/product-ui.test.ts
git commit -m "feat: move product management out of Settings" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full automated check**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck clean, all tests pass, build succeeds. Report any failure verbatim.

- [ ] **Step 2: Migration on legacy-like data (scratch database)**

Repeat Task 1 Step 9 (it applies every migration, inserts one order with an item, applies the new migration, and checks drift). Then drop the scratch databases (each Bash call is a fresh shell, so define `DB_URL` again first):

```bash
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\r')
psql -c 'DROP DATABASE IF EXISTS poosefilm_migtest' -c 'DROP DATABASE IF EXISTS poosefilm_shadow' "$DB_URL"
```

- [ ] **Step 3: Hand-off checklist for the owner (needs a login, done by the user)**

The developer applies the migration to the local dev database with `npx prisma migrate deploy`, then walks through:

1. Account menu shows "Produk" (superadmin only) and opens `/admin/products`. Settings no longer has a product section.
2. Add "Kaos" as Merch at 120000 with a description; add "Polaroid" as Cetak. Both show the right type pill. Editing a product keeps its type and description.
3. Search "kaos" finds it by name; search a word from a description finds it; Tipe = Merch shows only merch; Status = Nonaktif shows only inactive; Reset clears everything; a filter with no match shows "Tidak ada product yang cocok dengan filter."
4. Click "Nonaktifkan" on a row while a filter is active: the status changes and the filter stays applied.
5. Kasir: each product row shows a Cetak or Merch tag. Order 2 Polaroid and 1 Kaos: total counts both, the footer says `2 cetak`, the receipt lists both lines.
6. Rekap: "Total cetak real" counts the 2 prints only; "Pendapatan real" includes the Kaos.
7. Old orders still show their receipts and are counted as prints in Rekap.
8. Known limit for the next phase: a merch-only order still goes to the photo upload queue.

---

## Self-Review

**Spec coverage**
- `ProductKind` enum, `Product.kind` and `description`, `OrderItem.productKind` snapshot, migration with dropped default: Task 1.
- Service validation (kind, description trim, empty to null, 255 limit): Task 2. `serializeProduct` includes both: Task 1.
- `buildProductsWhere` (`q`, `type`, `status`, unknown means no filter) and `searchProducts`, `listProducts` unchanged for `createOrder`: Task 4 (`listProducts` is untouched).
- `resolveOrderItems` returns `productKind`, `countPrintQuantity`: Task 1. `createOrder` needs no code change because `items: { create: items }` carries `productKind`.
- Rekap counts only `PRINT`, revenue unchanged: Task 3.
- Cashier tag, print-only footer, submit enabled for any item: Task 3.
- New page (superadmin, filter form, table with all columns, modal editor with three intents, empty states, horizontal scroll): Task 5. Account menu link: Task 5.
- Settings cleanup: Task 6. Superseded note in the older spec: already done.
- Tests listed in the spec: pure (Tasks 1, 2, 4), source-content (Tasks 3, 5, 6), scratch migration and drift (Tasks 1, 7).

**Deviations from the spec:** none.

**Type consistency:** `ProductKind` and `isProductKind` come from `app/utils/product-kind.ts` everywhere. `ProductInput.kind` is a `string` (raw form value) narrowed by `isProductKind` in `normalizeProductInput`. `ProductSnapshotSource.kind` matches the `kind` returned by `serializeProduct`. `countPrintQuantity` takes `{ productKind, quantity }`, matching the cashier `items` shape after Task 3. The URL param `type` maps to `filters.kind` in the loader and `buildProductsWhere`.
