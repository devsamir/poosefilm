# Multi-Product Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single global "price per print" with a master product list; cashier picks any mix of products with a quantity each, and the order total is the sum of the lines.

**Architecture:** New `Product` and `OrderItem` tables. Rollout is expand then contract so typecheck and tests stay green after every task: migration 1 creates the tables, backfills, and makes the legacy price columns nullable; app code is switched over; migration 2 drops the legacy columns. Pure logic (item parsing, validation, snapshot resolution, totals) lives in `app/utils/order-items.ts` so it is unit-testable without a database.

**Tech Stack:** Remix 2 (Vite), Prisma 5 + PostgreSQL, Vitest, Tailwind. Spec: `docs/superpowers/specs/2026-09-19-multi-product-orders-design.md`.

**Conventions to follow (from this codebase):**
- Tests are `tests/*.test.ts`, run with `npx vitest run`. There are no database tests; DB code is checked by pure-function tests, source-content tests (`readFileSync` + `toContain`), and a manual pass in Task 8.
- User-facing strings are Indonesian. No emojis.
- Commit messages: `feat:` / `fix:` / `docs:` / `test:` prefixes, ending with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Baseline before starting: `npm run typecheck` is clean and `npx vitest run` shows 22 files / 78 tests passing.

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | modify | Add `Product`, `OrderItem`; relax then drop legacy columns |
| `prisma/migrations/20260919090000_add_products_and_order_items/migration.sql` | create | Expand: tables, backfill, legacy columns nullable |
| `prisma/migrations/20260919100000_drop_legacy_price_columns/migration.sql` | create | Contract: drop legacy columns |
| `app/utils/order-items.ts` | create | Pure: parse form fields, validate items, resolve snapshots, total |
| `app/services/products.server.ts` | create | Product CRUD and price/name validation |
| `app/components/ProductEditor.tsx` | create | Product create/edit form used in the Settings modal |
| `app/utils/order-invariants.ts` | modify | `buildOrderSnapshot` takes items |
| `app/services/orders.server.ts` | modify | `createOrder` with items, `serializeReceiptOrder`, include items |
| `app/services/reports.server.ts` | modify | `totalPrints` from order items |
| `app/routes/admin.cashier.tsx` | modify | Per-product quantity rows |
| `app/routes/admin.receipt.$code.tsx`, `app/components/Receipt.tsx` | modify | Item lines on the receipt |
| `app/routes/admin.settings.tsx` | modify | Product library; later remove the price card |
| `app/services/settings.server.ts`, `app/services/users.server.ts`, `prisma/seed.ts`, `README.md` | modify | Remove the global price |
| `tests/product-schema.test.ts`, `tests/order-items.test.ts`, `tests/products.test.ts`, `tests/product-ui.test.ts` | create | New tests |
| `tests/order-models.test.ts`, `tests/orders.test.ts`, `tests/settings-users.test.ts`, `tests/settings-ui.test.ts` | modify | Adapt to new API |

---

### Task 1: Schema, expand migration, and backfill

**Files:**
- Create: `tests/product-schema.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260919090000_add_products_and_order_items/migration.sql`

- [ ] **Step 1: Write the failing test**

Create `tests/product-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("multi-product schema", () => {
  it("defines products and per-order items with price snapshots", () => {
    expect(schema).toContain("model Product");
    expect(schema).toContain("model OrderItem");
    expect(schema).toContain("productName");
    expect(schema).toContain("@@unique([orderId, productId])");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/product-schema.test.ts`
Expected: FAIL, `expected '...' to contain 'model Product'`.

- [ ] **Step 3: Edit `prisma/schema.prisma`**

In `model Order`, make the legacy columns optional and add the relation. Replace

```prisma
  quantity          Int
  unitPrice         Decimal               @map("unit_price") @db.Decimal(12, 2)
```

with

```prisma
  quantity          Int?
  unitPrice         Decimal?              @map("unit_price") @db.Decimal(12, 2)
```

and add `items` next to the other relations. Replace

```prisma
  filterSnapshots   OrderFilterSnapshot[]
  files             OrderFile[]

  @@index([status, createdAt])
```

with

```prisma
  filterSnapshots   OrderFilterSnapshot[]
  files             OrderFile[]
  items             OrderItem[]

  @@index([status, createdAt])
```

In `model AppSetting`, replace

```prisma
  pricePerPrint    Decimal  @map("price_per_print") @db.Decimal(12, 2)
```

with

```prisma
  pricePerPrint    Decimal? @map("price_per_print") @db.Decimal(12, 2)
```

Append these two models at the end of the file:

```prisma
model Product {
  id        Int         @id @default(autoincrement())
  name      String      @unique
  price     Decimal     @db.Decimal(12, 2)
  isActive  Boolean     @default(true) @map("is_active")
  items     OrderItem[]
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")

  @@map("products")
}

model OrderItem {
  id          Int     @id @default(autoincrement())
  orderId     Int     @map("order_id")
  productId   Int     @map("product_id")
  productName String  @map("product_name")
  unitPrice   Decimal @map("unit_price") @db.Decimal(12, 2)
  quantity    Int
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([orderId, productId])
  @@map("order_items")
}
```

- [ ] **Step 4: Create the migration**

Create `prisma/migrations/20260919090000_add_products_and_order_items/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: the global price becomes the first product, each old order gets one item
INSERT INTO "products" ("name", "price", "updated_at")
SELECT 'Cetak', COALESCE((SELECT "price_per_print" FROM "app_settings" WHERE "id" = 1), 95000), CURRENT_TIMESTAMP;

INSERT INTO "order_items" ("order_id", "product_id", "product_name", "unit_price", "quantity")
SELECT o."id", p."id", p."name", o."unit_price", o."quantity"
FROM "orders" o CROSS JOIN "products" p
WHERE p."name" = 'Cetak';

-- AlterTable: legacy pricing columns become optional; they are dropped in a later migration
ALTER TABLE "orders" ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "unit_price" DROP NOT NULL;

-- AlterTable
ALTER TABLE "app_settings" ALTER COLUMN "price_per_print" DROP NOT NULL;
```

- [ ] **Step 5: Regenerate the client and run the test**

Stop any running dev server first (on Windows it locks the Prisma engine file).

Run: `npx prisma validate && npx prisma generate && npx vitest run tests/product-schema.test.ts`
Expected: `The schema at prisma\schema.prisma is valid`, client generated, test PASS.

- [ ] **Step 6: Verify the migration on a scratch database with legacy data**

This never touches the dev database `poosefilm`; it creates `poosefilm_migtest` and `poosefilm_shadow`.

```bash
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
SCRATCH_URL=$(echo "$DB_URL" | sed -E 's#/poosefilm(\?.*)?$#/poosefilm_migtest\1#')
SHADOW_URL=$(echo "$DB_URL" | sed -E 's#/poosefilm(\?.*)?$#/poosefilm_shadow\1#')
psql "$DB_URL" -c 'DROP DATABASE IF EXISTS poosefilm_migtest' -c 'CREATE DATABASE poosefilm_migtest' -c 'DROP DATABASE IF EXISTS poosefilm_shadow' -c 'CREATE DATABASE poosefilm_shadow'
for d in $(ls -d prisma/migrations/*/ | grep -v -e add_products_and_order_items -e drop_legacy_price_columns); do psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -q -f "${d}migration.sql"; done
psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO app_settings (price_per_print, updated_at) VALUES (120000, now());
INSERT INTO users (name, email, password_hash, updated_at) VALUES ('T', 't@t.id', 'x', now());
INSERT INTO orders (code, customer_name, whatsapp, quantity, unit_price, total_amount, is_real_transaction, payment_method, payment_status, created_by_id, updated_at)
VALUES ('T1', 'A', '08111', 3, 120000, 360000, true, 'CASH', 'PAID', 1, now()),
       ('T2', 'B', '08222', 2, 120000, 0, false, 'CASH', 'PAID', 1, now());
SQL
psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -q -f prisma/migrations/20260919090000_add_products_and_order_items/migration.sql
psql "$SCRATCH_URL" -c "SELECT name, price, is_active FROM products" -c "SELECT o.code, o.total_amount, i.product_name, i.unit_price, i.quantity FROM orders o JOIN order_items i ON i.order_id = o.id ORDER BY o.code"
```

Expected: `products` has one row `Cetak | 120000.00 | t`; the join shows two rows: `T1 | 360000.00 | Cetak | 120000.00 | 3` and `T2 | 0.00 | Cetak | 120000.00 | 2`. Order count equals item count and `total_amount` is unchanged.

- [ ] **Step 7: Verify there is no drift between migrations and schema**

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --exit-code
```

Expected: exit code 0 and `No difference detected.` If it prints a diff, fix `migration.sql` (not the schema) until it is clean.

- [ ] **Step 8: Typecheck, full tests, commit**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all tests pass (79 tests).

```bash
git add prisma/schema.prisma prisma/migrations/20260919090000_add_products_and_order_items tests/product-schema.test.ts
git commit -m "feat: add product and order item tables with backfill" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure order-item helpers

**Files:**
- Create: `tests/order-items.test.ts`
- Create: `app/utils/order-items.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/order-items.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { calculateOrderTotal, parseOrderItemFields, resolveOrderItems, validateOrderItems } from "~/utils/order-items";

describe("parseOrderItemFields", () => {
  it("reads qty_<productId> fields and skips blank, zero, and unrelated fields", () => {
    const entries: Array<[string, string]> = [["customerName", "Husein"], ["qty_1", "2"], ["qty_2", "0"], ["qty_3", ""], ["qty_4", "5"]];
    expect(parseOrderItemFields(entries)).toEqual([{ productId: 1, quantity: 2 }, { productId: 4, quantity: 5 }]);
  });

  it("keeps invalid quantities so validation can reject them", () => {
    expect(parseOrderItemFields([["qty_1", "-1"], ["qty_2", "1.5"]])).toEqual([{ productId: 1, quantity: -1 }, { productId: 2, quantity: 1.5 }]);
  });
});

describe("validateOrderItems", () => {
  it("accepts distinct products with positive integer quantities", () => {
    const items = [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }];
    expect(validateOrderItems(items)).toEqual(items);
  });

  it("rejects an empty order", () => {
    expect(() => validateOrderItems([])).toThrow("Pilih minimal satu product.");
  });

  it("rejects non-positive or fractional quantities", () => {
    expect(() => validateOrderItems([{ productId: 1, quantity: 0 }])).toThrow("Jumlah product wajib valid.");
    expect(() => validateOrderItems([{ productId: 1, quantity: 1.5 }])).toThrow("Jumlah product wajib valid.");
  });

  it("rejects an invalid product id and duplicate products", () => {
    expect(() => validateOrderItems([{ productId: Number.NaN, quantity: 1 }])).toThrow("Product tidak valid.");
    expect(() => validateOrderItems([{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }])).toThrow("Product tidak boleh duplikat.");
  });
});

describe("resolveOrderItems", () => {
  const products = [
    { id: 1, name: "Strip 2 pose", price: 50000, isActive: true },
    { id: 2, name: "Cabinet", price: 95000, isActive: true },
    { id: 3, name: "Lama", price: 10000, isActive: false },
  ];

  it("snapshots the current name and price of each product", () => {
    expect(resolveOrderItems([{ productId: 2, quantity: 3 }], products)).toEqual([{ productId: 2, productName: "Cabinet", unitPrice: 95000, quantity: 3 }]);
  });

  it("rejects a missing or inactive product", () => {
    expect(() => resolveOrderItems([{ productId: 99, quantity: 1 }], products)).toThrow("Product tidak ditemukan atau sudah nonaktif.");
    expect(() => resolveOrderItems([{ productId: 3, quantity: 1 }], products)).toThrow("Product tidak ditemukan atau sudah nonaktif.");
  });
});

describe("calculateOrderTotal", () => {
  const items = [{ unitPrice: 95000, quantity: 3 }, { unitPrice: 50000, quantity: 2 }];

  it("sums every line", () => {
    expect(calculateOrderTotal(items)).toBe(385000);
  });

  it("is zero for a non-real transaction", () => {
    expect(calculateOrderTotal(items, false)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/order-items.test.ts`
Expected: FAIL, cannot resolve `~/utils/order-items`.

- [ ] **Step 3: Implement**

Create `app/utils/order-items.ts`:

```ts
export type OrderItemInput = { productId: number; quantity: number };
export type ProductSnapshotSource = { id: number; name: string; price: number; isActive: boolean };

const QUANTITY_FIELD_PREFIX = "qty_";

/** Reads `qty_<productId>` form fields, skipping blank and zero quantities. */
export function parseOrderItemFields(entries: Iterable<[string, FormDataEntryValue]>): OrderItemInput[] {
  const items: OrderItemInput[] = [];
  for (const [name, value] of entries) {
    if (!name.startsWith(QUANTITY_FIELD_PREFIX)) continue;
    const raw = String(value).trim();
    if (!raw || Number(raw) === 0) continue;
    items.push({ productId: Number(name.slice(QUANTITY_FIELD_PREFIX.length)), quantity: Number(raw) });
  }
  return items;
}

/** Requires at least one item, valid ids, positive integer quantities, and no repeated product. */
export function validateOrderItems(items: OrderItemInput[]) {
  if (!items.length) throw new Error("Pilih minimal satu product.");
  const seenProductIds = new Set<number>();
  for (const item of items) {
    if (!Number.isInteger(item.productId) || item.productId < 1) throw new Error("Product tidak valid.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error("Jumlah product wajib valid.");
    if (seenProductIds.has(item.productId)) throw new Error("Product tidak boleh duplikat.");
    seenProductIds.add(item.productId);
  }
  return items;
}

/** Copies the current name and price of each requested product so later edits never change the order. */
export function resolveOrderItems(items: OrderItemInput[], products: ProductSnapshotSource[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  return items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product || !product.isActive) throw new Error("Product tidak ditemukan atau sudah nonaktif.");
    return { productId: product.id, productName: product.name, unitPrice: product.price, quantity: item.quantity };
  });
}

export function calculateOrderTotal(items: { unitPrice: number; quantity: number }[], isRealTransaction = true) {
  if (!isRealTransaction) return 0;
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/order-items.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add app/utils/order-items.ts tests/order-items.test.ts
git commit -m "feat: add pure helpers for order item parsing, validation, and totals" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Product service

**Files:**
- Create: `tests/products.test.ts`
- Create: `app/services/products.server.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/products.test.ts`:

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

  it("trims the name, converts the price, and defaults to active", () => {
    expect(normalizeProductInput({ name: "  Strip 2 pose ", price: "50000" })).toEqual({ name: "Strip 2 pose", price: 50000, isActive: true });
    expect(normalizeProductInput({ name: "Lama", price: "10000", isActive: false })).toEqual({ name: "Lama", price: 10000, isActive: false });
  });

  it("requires a name", () => {
    expect(() => normalizeProductInput({ name: "   ", price: "50000" })).toThrow("Nama wajib diisi.");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/products.test.ts`
Expected: FAIL, cannot resolve `~/services/products.server`.

- [ ] **Step 3: Implement**

Create `app/services/products.server.ts`:

```ts
import { Prisma } from "@prisma/client";

import { prisma } from "~/services/prisma.server";

export type ProductInput = { name: string; price: string; isActive?: boolean };

export function validateProductPrice(value: string) {
  if (!/^\d+$/.test(value.trim()) || Number(value) <= 0) {
    throw new Error("Harga harus berupa bilangan bulat positif.");
  }
  return Number(value);
}

export function normalizeProductInput(input: ProductInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Nama wajib diisi.");
  return { name, price: validateProductPrice(input.price), isActive: input.isActive ?? true };
}

function serializeProduct(product: { id: number; name: string; price: Prisma.Decimal; isActive: boolean }) {
  return { id: product.id, name: product.name, price: Number(product.price), isActive: product.isActive };
}

function rethrowDuplicateName(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("Nama product sudah dipakai.");
  throw error;
}

export async function listProducts() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return products.map(serializeProduct);
}

export async function listActiveProducts() {
  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return products.map(serializeProduct);
}

export async function createProduct(input: ProductInput) {
  const data = normalizeProductInput(input);
  try {
    return serializeProduct(await prisma.product.create({ data }));
  } catch (error) {
    return rethrowDuplicateName(error);
  }
}

export async function updateProduct(id: number, input: ProductInput) {
  const data = normalizeProductInput(input);
  try {
    return serializeProduct(await prisma.product.update({ where: { id }, data }));
  } catch (error) {
    return rethrowDuplicateName(error);
  }
}
```

- [ ] **Step 4: Run to verify pass, then typecheck**

Run: `npx vitest run tests/products.test.ts && npm run typecheck`
Expected: PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add app/services/products.server.ts tests/products.test.ts
git commit -m "feat: add product service with validation" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Master product UI in Settings

The old "Harga per cetak" card stays until Task 7 so the app keeps working while the switch is in progress.

**Files:**
- Create: `tests/product-ui.test.ts`
- Create: `app/components/ProductEditor.tsx`
- Modify: `app/routes/admin.settings.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/product-ui.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("product administration UI", () => {
  it("lets superadmin manage the product master from Settings", () => {
    const settings = source("app/routes/admin.settings.tsx");
    expect(settings).toContain("requireSuperadmin");
    expect(settings).toContain('data-testid="product-library"');
    expect(settings).toContain("createProduct");
    expect(settings).toContain("ProductEditor");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-ui.test.ts`
Expected: FAIL, `expected '...' to contain 'data-testid="product-library"'`.

- [ ] **Step 3: Create the editor component**

Create `app/components/ProductEditor.tsx`:

```tsx
import { Form } from "@remix-run/react";

type ProductData = { id: number; name: string; price: number; isActive: boolean };

export function ProductEditor({ intent, product, submitLabel }: { intent: "product-create" | "product-update"; product?: ProductData; submitLabel: string }) {
  return (
    <Form method="post" className="space-y-4 rounded-xl border border-[#eee7df] p-4">
      <input type="hidden" name="intent" value={intent} />
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <label className="field-label">Nama product<input className="field-input" name="name" defaultValue={product?.name || ""} required autoFocus /></label>
      <label className="field-label">Harga dalam Rupiah<input className="field-input" type="number" name="price" min="1" step="1" defaultValue={product?.price} required /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} />Aktif (tampil di kasir)</label>
      <button className="button-secondary text-xs" type="submit">{submitLabel}</button>
    </Form>
  );
}
```

- [ ] **Step 4: Wire it into `app/routes/admin.settings.tsx`**

4a. Imports. Replace

```tsx
import { FilterPackageEditor } from "~/components/FilterPackageEditor";
import { SettingsModal } from "~/components/SettingsModal";
```

with

```tsx
import { FilterPackageEditor } from "~/components/FilterPackageEditor";
import { ProductEditor } from "~/components/ProductEditor";
import { SettingsModal } from "~/components/SettingsModal";
```

and replace

```tsx
import { getPricePerPrint, getWhatsappTemplate, updatePricePerPrint, updateWhatsappTemplate, validateWhatsappTemplate } from "~/services/settings.server";
```

with

```tsx
import { createProduct, listProducts, updateProduct } from "~/services/products.server";
import { getPricePerPrint, getWhatsappTemplate, updatePricePerPrint, updateWhatsappTemplate, validateWhatsappTemplate } from "~/services/settings.server";
```

4b. Loader. Replace

```tsx
  const [price, whatsappTemplate, filters, packages] = await Promise.all([getPricePerPrint(), getWhatsappTemplate(), listFilterTemplates(), listFilterPackages()]);
  return json({ price: Number(price), whatsappTemplate, filters, packages });
```

with

```tsx
  const [price, whatsappTemplate, filters, packages, products] = await Promise.all([getPricePerPrint(), getWhatsappTemplate(), listFilterTemplates(), listFilterPackages(), listProducts()]);
  return json({ price: Number(price), whatsappTemplate, filters, packages, products });
```

4c. Action. Insert this block directly before the line `await updatePricePerPrint(validatePricePerPrint(...))`:

```tsx
    if (intent === "product-create" || intent === "product-update") {
      const input = { name: String(formData.get("name") || ""), price: String(formData.get("price") || ""), isActive: formData.get("isActive") === "on" };
      if (intent === "product-create") await createProduct(input);
      else await updateProduct(Number(formData.get("id")), input);
      return json({ success: "Product berhasil disimpan." });
    }
```

4d. Modal state. Replace

```tsx
  | { type: "package"; id?: number };
```

with

```tsx
  | { type: "package"; id?: number }
  | { type: "product"; id?: number };
```

4e. Component state. Replace

```tsx
  const { price, whatsappTemplate, filters, packages } = useLoaderData<typeof loader>();
```

with

```tsx
  const { price, whatsappTemplate, filters, packages, products } = useLoaderData<typeof loader>();
```

and replace

```tsx
  const selectedPackage = modal?.type === "package" && modal.id ? packages.find((packageData) => packageData.id === modal.id) : undefined;
```

with

```tsx
  const selectedPackage = modal?.type === "package" && modal.id ? packages.find((packageData) => packageData.id === modal.id) : undefined;
  const selectedProduct = modal?.type === "product" && modal.id ? products.find((product) => product.id === modal.id) : undefined;
```

4f. Product library section. Insert this block immediately before `<section className="settings-section" data-testid="filter-library">`:

```tsx
    <section className="settings-section" data-testid="product-library">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="settings-label">Katalog</p><h2 className="mt-2 font-display text-3xl text-[#1f2528]">Master product</h2><p className="mt-2 text-sm text-[#667177]">Product dan harga yang tersedia untuk dipilih kasir.</p></div><button className="button-primary" type="button" onClick={() => setModal({ type: "product" })}>+ Product baru</button></div>
      {products.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <article key={product.id} className="library-card"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold text-[#1f2528]">{product.name}</h3><span className={`status-pill ${product.isActive ? "status-ready" : "status-waiting"}`}>{product.isActive ? "Aktif" : "Nonaktif"}</span></div><p className="mt-2 text-sm text-[#667177]">{currencyFormatter.format(product.price)}</p><div className="mt-4"><button className="settings-action" type="button" onClick={() => setModal({ type: "product", id: product.id })}>Edit</button></div></article>)}</div> : <div className="empty-library mt-6"><p>Belum ada product.</p><button className="settings-action mt-2" type="button" onClick={() => setModal({ type: "product" })}>Buat product pertama</button></div>}
    </section>

```

4g. Modal render. Insert this line immediately before the line starting `{modal?.type === "filter" ? <SettingsModal`:

```tsx
    {modal?.type === "product" ? <SettingsModal open title={selectedProduct ? `Edit ${selectedProduct.name}` : "Buat product baru"} description="Product yang nonaktif tidak muncul di kasir, tapi order lama tetap menyimpan nama dan harganya." onClose={() => setModal(null)}><ProductEditor key={selectedProduct?.id || "new-product"} intent={selectedProduct ? "product-update" : "product-create"} product={selectedProduct} submitLabel={selectedProduct ? "Simpan perubahan" : "Simpan product"} /></SettingsModal> : null}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run tests/product-ui.test.ts tests/settings-ui.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add app/components/ProductEditor.tsx app/routes/admin.settings.tsx tests/product-ui.test.ts
git commit -m "feat: add master product management to Settings" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Create orders from product items (cashier, receipt, order service)

The legacy columns are nullable after Task 1, so nothing here writes them any more and typecheck stays green.

**Files:**
- Modify: `tests/order-models.test.ts`, `tests/orders.test.ts`, `tests/product-ui.test.ts`
- Modify: `app/utils/order-invariants.ts`, `app/services/orders.server.ts`
- Modify: `app/components/Receipt.tsx`, `app/routes/admin.receipt.$code.tsx`, `app/routes/admin.cashier.tsx`

- [ ] **Step 1: Update the tests first**

In `tests/order-models.test.ts` replace the first two `it` blocks (the snapshot ones) with:

```ts
  it("totals every item at its snapshotted price", () => {
    expect(buildOrderSnapshot({ items: [{ unitPrice: 95000, quantity: 3 }, { unitPrice: 50000, quantity: 2 }] })).toEqual({
      totalAmount: 385000,
      isRealTransaction: true,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      status: "WAITING_UPLOAD",
    });
  });

  it("sets non-real transactions to zero value", () => {
    expect(buildOrderSnapshot({ items: [{ unitPrice: 95000, quantity: 3 }], isRealTransaction: false })).toMatchObject({
      totalAmount: 0,
      isRealTransaction: false,
    });
  });
```

In `tests/orders.test.ts` change the import line to

```ts
import { parseOptionalFilterPackageId, serializeReceiptOrder, validateOrderInput } from '~/services/orders.server';
```

and replace the two tests `validates customer details and quantity` and `rejects a WhatsApp number with no digits` (keep the code-generation and filter-package tests) with:

```ts
  it('validates customer details and items', () => {
    expect(
      validateOrderInput({
        customerName: ' Husein ',
        whatsapp: '081234',
        items: [{ productId: 1, quantity: 2 }],
      })
    ).toEqual({
      customerName: 'Husein',
      whatsapp: '081234',
      items: [{ productId: 1, quantity: 2 }],
    });
    expect(() =>
      validateOrderInput({ customerName: '', whatsapp: '081234', items: [{ productId: 1, quantity: 1 }] })
    ).toThrow();
    expect(() =>
      validateOrderInput({ customerName: 'Husein', whatsapp: '081234', items: [] })
    ).toThrow('Pilih minimal satu product.');
  });

  it('rejects a WhatsApp number with no digits', () => {
    expect(() =>
      validateOrderInput({ customerName: 'Husein', whatsapp: '-', items: [{ productId: 1, quantity: 1 }] })
    ).toThrow();
  });

  it('serializes an order with its item lines for the receipt', () => {
    expect(
      serializeReceiptOrder({
        code: 'PB260919-AAAA1111',
        createdAt: new Date('2026-09-19T03:00:00Z'),
        customerName: 'Husein',
        whatsapp: '081234',
        isRealTransaction: true,
        totalAmount: 385000,
        items: [
          { id: 1, productName: 'Cabinet', quantity: 3, unitPrice: 95000 },
          { id: 2, productName: 'Strip 2 pose', quantity: 2, unitPrice: 50000 },
        ],
      })
    ).toEqual({
      code: 'PB260919-AAAA1111',
      createdAt: '2026-09-19T03:00:00.000Z',
      customerName: 'Husein',
      whatsapp: '081234',
      isRealTransaction: true,
      totalAmount: 385000,
      items: [
        { id: 1, productName: 'Cabinet', quantity: 3, unitPrice: 95000 },
        { id: 2, productName: 'Strip 2 pose', quantity: 2, unitPrice: 50000 },
      ],
    });
  });
```

Append to `tests/product-ui.test.ts` inside the file (new `describe` after the existing one):

```ts
describe("cashier and receipt use product items", () => {
  it("renders one quantity input per active product", () => {
    const cashier = source("app/routes/admin.cashier.tsx");
    expect(cashier).toContain("listActiveProducts");
    expect(cashier).toContain("name={`qty_${product.id}`}");
    expect(cashier).toContain("parseOrderItemFields");
    expect(cashier).not.toContain('name="quantity"');
  });

  it("lists item lines on the receipt instead of a single print count", () => {
    const receipt = source("app/components/Receipt.tsx");
    expect(receipt).toContain("order.items.map");
    expect(receipt).not.toContain("Jumlah cetak");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/order-models.test.ts tests/orders.test.ts tests/product-ui.test.ts`
Expected: FAIL in all three files (old signatures, missing exports, missing content).

- [ ] **Step 3: Rewrite `app/utils/order-invariants.ts`**

Replace the whole file with:

```ts
import { calculateOrderTotal } from "~/utils/order-items";

export type OrderSnapshotInput = {
  items: { unitPrice: number; quantity: number }[];
  isRealTransaction?: boolean;
};

export function buildOrderSnapshot({ items, isRealTransaction = true }: OrderSnapshotInput) {
  return {
    totalAmount: calculateOrderTotal(items, isRealTransaction),
    isRealTransaction,
    paymentMethod: "CASH" as const,
    paymentStatus: "PAID" as const,
    status: "WAITING_UPLOAD" as const,
  };
}
```

- [ ] **Step 4: Update `app/services/orders.server.ts`**

4a. Imports. Replace

```ts
import { deleteObjectIfPresent } from "~/services/r2.server";
import { getPricePerPrint } from "~/services/settings.server";
import { buildOrderSnapshot } from "~/utils/order-invariants";
```

with

```ts
import { listProducts } from "~/services/products.server";
import { deleteObjectIfPresent } from "~/services/r2.server";
import { buildOrderSnapshot } from "~/utils/order-invariants";
import { resolveOrderItems, validateOrderItems, type OrderItemInput } from "~/utils/order-items";
```

4b. Replace `validateOrderInput` with

```ts
export function validateOrderInput(input: { customerName: string; whatsapp: string; items: OrderItemInput[] }) {
  const { customerName, whatsapp } = validateContactInput(input);
  return { customerName, whatsapp, items: validateOrderItems(input.items) };
}
```

4c. Replace the first four lines of `createOrder` (the signature through the `snapshot` line):

```ts
export async function createOrder(input: { customerName: string; whatsapp: string; quantity: string; isRealTransaction?: boolean; marketingConsent?: boolean; filterPackageId?: number }, createdById: number) {
  const details = validateOrderInput(input);
  const price = Number(await getPricePerPrint());
  const snapshot = buildOrderSnapshot({ quantity: details.quantity, unitPrice: price, isRealTransaction: input.isRealTransaction !== false });
```

with

```ts
export async function createOrder(input: { customerName: string; whatsapp: string; items: OrderItemInput[]; isRealTransaction?: boolean; marketingConsent?: boolean; filterPackageId?: number }, createdById: number) {
  const details = validateOrderInput(input);
  const items = resolveOrderItems(details.items, await listProducts());
  const snapshot = buildOrderSnapshot({ items, isRealTransaction: input.isRealTransaction !== false });
```

4d. In the `data:` object of `createOrder`, replace

```ts
          quantity: details.quantity,
          unitPrice: snapshot.unitPrice,
          totalAmount: snapshot.totalAmount,
```

with

```ts
          totalAmount: snapshot.totalAmount,
```

and replace

```ts
          createdById,
          ...(selectedPackage
```

with

```ts
          createdById,
          items: { create: items },
          ...(selectedPackage
```

and replace `include: { files: true, filterSnapshots: true },` with `include: { files: true, filterSnapshots: true, items: true },`.

4e. In `getOrderByCode`, add items to the include. Replace

```ts
filterSnapshots: { orderBy: { sortOrder: "asc" } }, filterPackage: true },
```

with

```ts
filterSnapshots: { orderBy: { sortOrder: "asc" } }, filterPackage: true, items: { orderBy: { id: "asc" } } },
```

4f. Add this function right after `getOrderByCode`:

```ts
export function serializeReceiptOrder(order: { code: string; createdAt: Date; customerName: string; whatsapp: string; isRealTransaction: boolean; totalAmount: Prisma.Decimal | number; items: Array<{ id: number; productName: string; quantity: number; unitPrice: Prisma.Decimal | number }> }) {
  return {
    code: order.code,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customerName,
    whatsapp: order.whatsapp,
    isRealTransaction: order.isRealTransaction,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({ id: item.id, productName: item.productName, quantity: item.quantity, unitPrice: Number(item.unitPrice) })),
  };
}
```

- [ ] **Step 5: Update the receipt component `app/components/Receipt.tsx`**

Replace the `ReceiptOrder` type line

```tsx
type ReceiptOrder = { code: string; createdAt: string; customerName: string; whatsapp: string; quantity: number; totalAmount: number };
```

with

```tsx
type ReceiptItem = { id: number; productName: string; quantity: number; unitPrice: number };
type ReceiptOrder = { code: string; createdAt: string; customerName: string; whatsapp: string; isRealTransaction: boolean; totalAmount: number; items: ReceiptItem[] };

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
```

Replace the "Jumlah cetak" row

```tsx
        <div className="flex justify-between gap-4"><dt className="text-[#84796c]">Jumlah cetak</dt><dd>{order.quantity}</dd></div>
```

with

```tsx
        {order.items.map((item) => <div key={item.id} className="flex justify-between gap-4"><dt className="text-[#84796c]">{item.productName} x {item.quantity}</dt><dd>{order.isRealTransaction ? rupiah.format(item.unitPrice * item.quantity) : null}</dd></div>)}
```

Replace the total row's inline formatter

```tsx
<dd className="font-bold">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(order.totalAmount)}</dd>
```

with

```tsx
<dd className="font-bold">{rupiah.format(order.totalAmount)}</dd>
```

- [ ] **Step 6: Update the receipt route `app/routes/admin.receipt.$code.tsx`**

Replace `import { getOrderByCode } from "~/services/orders.server";` with `import { getOrderByCode, serializeReceiptOrder } from "~/services/orders.server";` and replace the `return json({ order: { ... }, qrDataUrl: ... });` line with:

```tsx
  return json({ order: serializeReceiptOrder(order), qrDataUrl: await QRCode.toDataURL(`${baseUrl}/order/${order.code}`, { margin: 1, width: 220 }) });
```

- [ ] **Step 7: Rewrite the cashier route `app/routes/admin.cashier.tsx`**

Replace the whole file with:

```tsx
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from '@remix-run/react';

import { Receipt } from '~/components/Receipt';
import { requireUser } from '~/services/auth.server';
import { createOrder, parseOptionalFilterPackageId, serializeReceiptOrder } from '~/services/orders.server';
import { getActiveFilterPackages } from '~/services/filter-packages.server';
import { listActiveProducts } from '~/services/products.server';
import { calculateOrderTotal, parseOrderItemFields } from '~/utils/order-items';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [products, filterPackages] = await Promise.all([listActiveProducts(), getActiveFilterPackages()]);
  return json({
    products,
    filterPackages,
    publicBaseUrl: process.env.PUBLIC_ORDER_BASE_URL || 'http://localhost:3000',
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  try {
    const order = await createOrder(
      {
        customerName: String(formData.get('customerName') || ''),
        whatsapp: String(formData.get('whatsapp') || ''),
        items: parseOrderItemFields(formData.entries()),
        isRealTransaction: formData.get('isRealTransaction') === 'on',
        marketingConsent: formData.get('marketingConsent') === 'on',
        filterPackageId: parseOptionalFilterPackageId(String(formData.get('filterPackageId') || '')),
      },
      user.id
    );
    const publicBaseUrl =
      process.env.PUBLIC_ORDER_BASE_URL || 'http://localhost:3000';
    const qrDataUrl = await QRCode.toDataURL(
      `${publicBaseUrl}/order/${order.code}`,
      { margin: 1, width: 220 }
    );
    return json({
      order: serializeReceiptOrder(order),
      qrDataUrl,
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'Gagal membuat order.',
      },
      { status: 400 }
    );
  }
}

export default function CashierPage() {
  const { products, filterPackages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [isRealTransaction, setIsRealTransaction] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const order = actionData && 'order' in actionData ? actionData.order : null;
  const qrDataUrl =
    actionData && 'qrDataUrl' in actionData ? actionData.qrDataUrl : null;
  const error = actionData && 'error' in actionData ? actionData.error : null;
  const items = products.map((product) => ({
    unitPrice: product.price,
    quantity: quantities[product.id] || 0,
  }));
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  useEffect(() => {
    if (order?.code) {
      setQuantities({});
      setIsRealTransaction(true);
      setMarketingConsent(false);
    }
  }, [order?.code]);
  function changeQuantity(productId: number, value: string) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.floor(Number(value)) || 0),
    }));
  }
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div>
        <p className="eyebrow">KASIR</p>
        <h1 className="page-title">Buat order baru</h1>
        <p className="page-subtitle">
          Terima pembayaran cash, lalu cetak QR untuk customer.
        </p>
        <Form
          key={order?.code || 'new'}
          method="post"
          className="mt-8 rounded-2xl border border-[#e6ded2] bg-white p-6"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field-label sm:col-span-2">
              Nama customer
              <input
                className="field-input"
                name="customerName"
                placeholder="Contoh: Husein"
                required
              />
            </label>
            <label className="field-label sm:col-span-2">
              Nomor WhatsApp
              <input
                className="field-input"
                name="whatsapp"
                placeholder="08xxxxxxxxxx"
                required
              />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="field-label">Product</legend>
              {products.length ? (
                <div className="mt-2 divide-y divide-[#eee7df] rounded-xl border border-[#e6ded2]">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold">{product.name}</p>
                        <p className="text-xs text-[#968b7e]">
                          {rupiah.format(product.price)}
                        </p>
                      </div>
                      <input
                        className="field-input !mt-0 w-24"
                        name={`qty_${product.id}`}
                        type="number"
                        min="0"
                        step="1"
                        value={quantities[product.id] ?? 0}
                        onChange={(event) =>
                          changeQuantity(product.id, event.target.value)
                        }
                        aria-label={`Jumlah ${product.name}`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#968b7e]">
                  Belum ada product aktif. Minta superadmin menambahkannya di Settings.
                </p>
              )}
            </fieldset>
            <label className="field-label sm:col-span-2">
              Paket filter
              <select className="field-input" name="filterPackageId" defaultValue="">
                <option value="">Original saja</option>
                {filterPackages.map((filterPackage) => (
                  <option key={filterPackage.id} value={filterPackage.id}>
                    {filterPackage.name} ({filterPackage.filters.length} filter)
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-[#968b7e]">Setiap filter dibuat dari original, tidak berantai.</span>
            </label>
            <label className="flex items-center gap-3 self-end rounded-xl border border-[#e6ded2] p-4 sm:col-span-2">
              <input className="h-4 w-4 accent-[#25231f]" type="checkbox" name="marketingConsent" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} />
              <span><span className="block text-sm font-semibold">Boleh di-share ke sosmed Poosefilm</span><span className="mt-1 block text-xs text-[#84796c]">Customer setuju fotonya dipakai untuk promosi di media sosial Poosefilm.</span></span>
            </label>
            <label className="flex items-center gap-3 self-end rounded-xl border border-[#e6ded2] p-4 sm:col-span-2">
              <input className="h-4 w-4 accent-[#25231f]" type="checkbox" name="isRealTransaction" checked={isRealTransaction} onChange={(event) => setIsRealTransaction(event.target.checked)} />
              <span><span className="block text-sm font-semibold">Transaksi real</span><span className="mt-1 block text-xs text-[#84796c]">Matikan untuk order test/free dan total menjadi Rp0.</span></span>
            </label>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#eee7df] pt-5">
            <div>
              <p className="text-xs text-[#968b7e]">Total bayar</p>
              <p className="text-lg font-semibold">
                {rupiah.format(calculateOrderTotal(items, isRealTransaction))}
              </p>
              <p className="mt-1 text-xs text-[#968b7e]">
                {totalQuantity} cetak
              </p>
            </div>
            <button
              className="button-primary"
              type="submit"
              disabled={navigation.state === 'submitting' || totalQuantity === 0}
            >
              {navigation.state === 'submitting'
                ? 'Memproses...'
                : 'Proses pembayaran'}
            </button>
          </div>
          {totalQuantity === 0 ? (
            <p className="mt-4 text-sm text-[#968b7e]">
              Isi jumlah minimal satu product.
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        </Form>
      </div>
      {order && qrDataUrl ? (
        <Receipt order={order} qrDataUrl={qrDataUrl} />
      ) : (
        <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-[#d9d0c4] p-8 text-center text-sm leading-6 text-[#968b7e]">
          Receipt akan muncul di sini setelah pembayaran diproses.
        </div>
      )}
    </div>
  );
}
```

Note: the original WhatsApp label sat beside the quantity label in a two-column grid (`sm:grid-cols-2`). With quantity replaced by the full-width product block, WhatsApp is made `sm:col-span-2` like the name field.

- [ ] **Step 8: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all pass (the earlier `public-order.test.ts` assertions on `isRealTransaction` / `marketingConsent` in the cashier still hold); typecheck clean. If `formData.entries()` fails typecheck, wrap it as `Array.from(formData.entries())`.

- [ ] **Step 9: Commit**

```bash
git add app tests
git commit -m "feat: create orders from product items at the cashier" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Daily summary from order items

**Files:**
- Modify: `tests/product-ui.test.ts`
- Modify: `app/services/reports.server.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/product-ui.test.ts`:

```ts
describe("daily summary counts prints from order items", () => {
  it("aggregates item quantities of real orders only", () => {
    const reports = source("app/services/reports.server.ts");
    expect(reports).toContain("prisma.orderItem.aggregate");
    expect(reports).toContain("isRealTransaction: true");
    expect(reports).not.toContain("_sum: { quantity: true, totalAmount: true }");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-ui.test.ts`
Expected: FAIL, missing `prisma.orderItem.aggregate`.

- [ ] **Step 3: Update `getDailySummary`**

In `app/services/reports.server.ts` replace the body from `const where = ...` through the `return` line with:

```ts
  const where = { createdAt: { gte: start, lt: end } };
  const realWhere = { ...where, isRealTransaction: true };
  const [orders, realOrders, freeOrders, delivered, waiting, revenue, prints] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: realWhere }),
    prisma.order.count({ where: { ...where, isRealTransaction: false } }),
    prisma.order.count({ where: { ...where, status: "DELIVERED" } }),
    prisma.order.count({ where: { ...where, status: { in: ["WAITING_UPLOAD", "PROCESSING_FILTER", "READY"] } } }),
    prisma.order.aggregate({ where: realWhere, _sum: { totalAmount: true } }),
    prisma.orderItem.aggregate({ where: { order: realWhere }, _sum: { quantity: true } }),
  ]);
  return { date, totalOrders: orders, realOrders, freeOrders, totalPrints: prints._sum.quantity || 0, revenue: Number(revenue._sum.totalAmount || 0), delivered, waiting };
```

(`const { start, end } = getDateRange(date);` above it stays.)

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add app/services/reports.server.ts tests/product-ui.test.ts
git commit -m "feat: count daily prints from order items" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Remove the global price (contract)

After this task nothing references `pricePerPrint`, `Order.quantity`, or `Order.unitPrice`.

**Files:**
- Modify: `tests/product-schema.test.ts`, `tests/settings-users.test.ts`, `tests/settings-ui.test.ts`
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`
- Create: `prisma/migrations/20260919100000_drop_legacy_price_columns/migration.sql`
- Modify: `app/services/settings.server.ts`, `app/services/users.server.ts`, `app/routes/admin.settings.tsx`, `README.md`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe("multi-product schema", ...)` block of `tests/product-schema.test.ts`:

```ts
  it("no longer stores a single price or quantity on the order or settings", () => {
    const orderModel = schema.match(/model Order \{[\s\S]*?\n\}/)?.[0] ?? "";
    const settingModel = schema.match(/model AppSetting \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(orderModel).toContain("model Order");
    expect(orderModel).not.toContain("unitPrice");
    expect(orderModel).not.toMatch(/\n\s+quantity\s/);
    expect(settingModel).not.toContain("pricePerPrint");
  });
```

In `tests/settings-users.test.ts` remove `validatePricePerPrint,` from the import list and delete the whole `it("accepts only positive integer prices", ...)` block (that rule is now covered by `tests/products.test.ts`).

In `tests/settings-ui.test.ts` add inside the `it`:

```ts
    expect(source).not.toContain("Harga per cetak");
    expect(source).not.toContain("updatePricePerPrint");
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-schema.test.ts tests/settings-ui.test.ts`
Expected: FAIL (schema still has `unitPrice`; settings still has the price card).

- [ ] **Step 3: Edit the schema**

In `prisma/schema.prisma` delete these two lines from `model Order`:

```prisma
  quantity          Int?
  unitPrice         Decimal?              @map("unit_price") @db.Decimal(12, 2)
```

and delete this line from `model AppSetting`:

```prisma
  pricePerPrint    Decimal? @map("price_per_print") @db.Decimal(12, 2)
```

- [ ] **Step 4: Create the contract migration**

Create `prisma/migrations/20260919100000_drop_legacy_price_columns/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "orders" DROP COLUMN "quantity",
DROP COLUMN "unit_price";

-- AlterTable
ALTER TABLE "app_settings" DROP COLUMN "price_per_print";
```

- [ ] **Step 5: Remove the price code**

`app/services/settings.server.ts`: delete the `getPricePerPrint` and `updatePricePerPrint` functions, and in `updateWhatsappTemplate` replace

```ts
    create: { id: 1, pricePerPrint: 95000, whatsappTemplate: value },
```

with

```ts
    create: { id: 1, whatsappTemplate: value },
```

`app/services/users.server.ts`: delete the `validatePricePerPrint` function.

`prisma/seed.ts`: replace

```ts
    create: { id: 1, pricePerPrint: 95000 },
```

with

```ts
    create: { id: 1 },
```

`app/routes/admin.settings.tsx`:

- Replace the settings import with `import { getWhatsappTemplate, updateWhatsappTemplate, validateWhatsappTemplate } from "~/services/settings.server";` and delete the line `import { validatePricePerPrint } from "~/services/users.server";`.
- Loader: replace

```tsx
  const [price, whatsappTemplate, filters, packages, products] = await Promise.all([getPricePerPrint(), getWhatsappTemplate(), listFilterTemplates(), listFilterPackages(), listProducts()]);
  return json({ price: Number(price), whatsappTemplate, filters, packages, products });
```

with

```tsx
  const [whatsappTemplate, filters, packages, products] = await Promise.all([getWhatsappTemplate(), listFilterTemplates(), listFilterPackages(), listProducts()]);
  return json({ whatsappTemplate, filters, packages, products });
```

- Action: replace `const intent = String(formData.get("intent") || "price");` with `const intent = String(formData.get("intent") || "");` and replace the two lines

```tsx
    await updatePricePerPrint(validatePricePerPrint(String(formData.get("price") || "")));
    return json({ success: "Harga berhasil disimpan." });
```

with

```tsx
    return json({ error: "Aksi tidak dikenal." }, { status: 400 });
```

- Delete the `| { type: "price" }` line from `SettingsModalState`.
- Component: change `const { price, whatsappTemplate, filters, packages, products } = useLoaderData<typeof loader>();` to `const { whatsappTemplate, filters, packages, products } = useLoaderData<typeof loader>();`.
- Quick settings section: replace the whole `<section className="grid gap-4 lg:grid-cols-3" aria-label="Pengaturan cepat">...</section>` block with

```tsx
    <section className="grid gap-4" aria-label="Pengaturan cepat">
      <article className="settings-card"><div className="flex items-start justify-between gap-4"><div><p className="settings-label">Template WhatsApp</p><p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-[#667177]">{whatsappTemplate}</p></div><span className="settings-icon settings-icon-green">WA</span></div><button className="settings-action mt-6" type="button" onClick={() => setModal({ type: "whatsapp" })}>Edit template <span aria-hidden="true">↗</span></button></article>
    </section>
```

- Delete the whole `{modal?.type === "price" ? <SettingsModal ... </SettingsModal> : null}` line.
- Header subtitle: replace `Atur harga, pesan customer, dan resep visual untuk hasil foto Poosefilm.` with `Atur product, pesan customer, dan resep visual untuk hasil foto Poosefilm.`

`README.md`: replace `manage price, WhatsApp template, filter masters, and filter packages.` with `manage products (name, price), WhatsApp template, filter masters, and filter packages.` and replace ``- `Kasir`: create a paid cash order and print its QR receipt.`` with ``- `Kasir`: pick products and quantities, create a paid cash order, and print its QR receipt.``

- [ ] **Step 6: Regenerate, run tests, typecheck**

Stop any running dev server, then:

Run: `npx prisma validate && npx prisma generate && npx vitest run && npm run typecheck`
Expected: all pass, typecheck clean. Also run `npx eslint app tests` and expect no new errors.

- [ ] **Step 7: Verify the contract migration on the scratch database and check drift**

Re-run the scratch flow from Task 1 Step 6 (variables `DB_URL`, `SCRATCH_URL`, `SHADOW_URL` set the same way; drop and recreate both databases first), then apply the second migration on top of the legacy-data state:

```bash
psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -q -f prisma/migrations/20260919100000_drop_legacy_price_columns/migration.sql
psql "$SCRATCH_URL" -c "SELECT o.code, o.total_amount, i.product_name, i.unit_price, i.quantity FROM orders o JOIN order_items i ON i.order_id = o.id ORDER BY o.code" -c "\d orders"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --exit-code
```

Expected: the two order rows and their items survive with unchanged `total_amount`; `\d orders` has no `quantity` or `unit_price`; the diff command exits 0 with `No difference detected.`

- [ ] **Step 8: Commit**

```bash
git add -A prisma app tests README.md
git commit -m "feat: drop the global price per print" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: End-to-end check in the running app

This step changes the local dev database `poosefilm` (applies the two migrations). It is the developer machine's own database; do not run it against production.

- [ ] **Step 1: Apply migrations and seed**

```bash
npx prisma migrate deploy
npx prisma db seed
```

Expected: both new migrations applied; existing dev orders now have one `Cetak` item each. Quick check (orders and items should be equal):

```bash
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
psql "$DB_URL" -c "SELECT (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM order_items) AS items"
```

- [ ] **Step 2: Start the app**

Use the `poosefilm-web` config in `.claude/launch.json` (port 3100). Log in as `admin@poosefilm.id`.

- [ ] **Step 3: Walk through the flow and confirm each result**

1. Settings: the "Harga per cetak" card is gone; "Master product" shows `Cetak` with the old price. Add "Strip 2 pose" at 50000, then edit its price, then deactivate it and confirm it shows "Nonaktif". Reactivate it. Creating a product with an existing name shows "Nama product sudah dipakai."
2. Kasir: both active products appear with quantity 0; "Proses pembayaran" is disabled with the hint "Isi jumlah minimal satu product."
3. Enter Cetak x2 and Strip 2 pose x1: the total is `2 x Cetak price + 50000` and the footer shows `3 cetak`. Submit. The receipt lists both lines with subtotals and the correct total; quantities reset on the form.
4. Uncheck "Transaksi real" and submit another order: total Rp0, the receipt lists `name x qty` without subtotals.
5. Open an old order's receipt from Riwayat (`/admin/receipt/<code>`): one `Cetak x N` line, total unchanged.
6. Rekap for today: "Total cetak real" equals the sum of quantities of real orders and "Pendapatan real" equals the sum of their totals; the free order is not counted.
7. Deactivate a product in Settings, reload Kasir: it no longer appears. Old receipts still show its name.

- [ ] **Step 4: Final full check**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck clean, all tests pass, build succeeds. Report any failure verbatim instead of claiming success.

- [ ] **Step 5: Clean up the scratch databases**

```bash
psql "$DB_URL" -c 'DROP DATABASE IF EXISTS poosefilm_migtest' -c 'DROP DATABASE IF EXISTS poosefilm_shadow'
```

---

## Self-Review

**Spec coverage**
- All products are prints, `totalPrints` from item quantities: Task 6.
- `pricePerPrint` becomes first product, old orders backfilled: Task 1 migration, verified Task 1 Step 6 and Task 8 Step 1.
- Drop `Order.quantity`, `Order.unitPrice`, `AppSetting.pricePerPrint`: Task 7.
- No hard delete, only deactivate: Task 3 (no delete function) and Task 4 (no delete UI).
- Name and unit price snapshotted on `OrderItem`: Task 2 `resolveOrderItems` and Task 5 `createOrder`.
- Filter package unchanged: `createOrder` keeps its existing package logic.
- Free orders keep items with total 0: `calculateOrderTotal(items, false)` in Task 2, receipt omits subtotals in Task 5.
- Data model, unique `(orderId, productId)`, cascade and restrict FKs: Task 1.
- Services (`products.server.ts`, `createOrder` validation of empty, missing/inactive, duplicate; prices from DB): Tasks 2, 3, 5.
- UI (Settings card and modal, cashier rows with live total and blocked submit, receipt lines): Tasks 4, 5, 7.
- Testing list: order snapshot and total (Task 2, 5), validation and inactive/duplicate (Task 2), product service (Task 3), reports content (Task 6), migration on legacy data (Task 1, 7), route content checks (Tasks 4, 5, 7).

**Deviation from the spec:** the spec described one migration. This plan uses two (expand in Task 1, contract in Task 7) so every task ends with a green typecheck and test run. The final database state is identical; the spec's Migration section is updated to match.

**Type consistency:** `OrderItemInput { productId, quantity }` (Task 2) is used by `validateOrderInput` and `createOrder` (Task 5) and `parseOrderItemFields` (cashier). `resolveOrderItems` returns `{ productId, productName, unitPrice, quantity }`, matching the `OrderItem` columns passed to `items: { create: items }`. `serializeReceiptOrder` output matches the `ReceiptOrder` type in `Receipt.tsx`. `listProducts` / `listActiveProducts` return `{ id, name, price: number, isActive }`, matching `ProductSnapshotSource` and the cashier's `product.price`.
