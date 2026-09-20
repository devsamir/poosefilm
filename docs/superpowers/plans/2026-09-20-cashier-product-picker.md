# Cashier Product Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At the cashier, the order starts empty and products are added through a "+ Tambah product" popup, instead of listing every active product with a quantity input.

**Architecture:** UI only. The order becomes a list of lines `{ productId, quantity }` held in React state, with pure helper functions for add, set quantity, remove, and popup filtering (`app/utils/order-lines.ts`). Each line posts a hidden `qty_<productId>` input, so the server (`createOrder`, `parseOrderItemFields`, loader, action) does not change. The popup is a new `ProductPickerModal` built on the existing `SettingsModal`, which gains an optional `eyebrow` prop and a `data-autofocus` focus hook. There is no schema change and no migration.

**Tech Stack:** Remix 2 (Vite), React 18, Vitest, Tailwind. Spec: `docs/superpowers/specs/2026-09-20-cashier-product-picker-design.md`.

**Conventions to follow (from this codebase):**
- Tests are `tests/*.test.ts`, run with `npx vitest run`. There are no UI or DB tests: UI is checked by pure-function tests and source-content tests (`readFileSync` + `toContain`), plus a manual pass by the owner.
- User-facing strings are Indonesian. No emojis.
- Commit messages: `feat:` / `fix:` / `test:` / `docs:` prefixes, ending with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Work on branch `feat/multi-product-orders` (already checked out).
- Baseline before starting: `npm run typecheck` clean, `npx vitest run` shows 28 files / 117 tests passing.
- This plan has no schema change: do not run any prisma command, do not touch any database, do not start the dev server, do not log in, do not kill processes.

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/utils/order-lines.ts` | create | Pure order-line operations and popup filtering |
| `app/components/SettingsModal.tsx` | modify | Optional `eyebrow` prop, `data-autofocus` focus hook |
| `app/components/ProductPickerModal.tsx` | create | The "Tambah product" popup |
| `app/routes/admin.cashier.tsx` | modify | Order list from lines, "+ Tambah product" button, popup |
| `tests/order-lines.test.ts`, `tests/product-picker.test.ts` | create | New tests |
| `tests/product-ui.test.ts` | modify | Adapt the cashier assertions |

---

### Task 1: Pure order-line logic

**Files:**
- Create: `tests/order-lines.test.ts`, `app/utils/order-lines.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/order-lines.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { addOrderLine, filterPickerProducts, removeOrderLine, setOrderLineQuantity } from "~/utils/order-lines";

describe("addOrderLine", () => {
  it("appends a new product with quantity 1", () => {
    expect(addOrderLine([], 5)).toEqual([{ productId: 5, quantity: 1 }]);
    expect(addOrderLine([{ productId: 1, quantity: 2 }], 5)).toEqual([{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }]);
  });

  it("adds 1 to an existing product and keeps the line order", () => {
    const lines = [{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }];
    expect(addOrderLine(lines, 1)).toEqual([{ productId: 1, quantity: 3 }, { productId: 5, quantity: 1 }]);
  });

  it("does not mutate its input", () => {
    const lines = [{ productId: 1, quantity: 2 }];
    addOrderLine(lines, 1);
    addOrderLine(lines, 9);
    expect(lines).toEqual([{ productId: 1, quantity: 2 }]);
  });
});

describe("setOrderLineQuantity", () => {
  const lines = [{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }];

  it("sets the quantity of one line and leaves the others", () => {
    expect(setOrderLineQuantity(lines, 5, 4)).toEqual([{ productId: 1, quantity: 2 }, { productId: 5, quantity: 4 }]);
  });

  it("floors fractions and clamps anything below 1 to 1", () => {
    expect(setOrderLineQuantity(lines, 1, 3.9)[0].quantity).toBe(3);
    expect(setOrderLineQuantity(lines, 1, 0)[0].quantity).toBe(1);
    expect(setOrderLineQuantity(lines, 1, -4)[0].quantity).toBe(1);
    expect(setOrderLineQuantity(lines, 1, 0.5)[0].quantity).toBe(1);
    expect(setOrderLineQuantity(lines, 1, Number.NaN)[0].quantity).toBe(1);
    expect(setOrderLineQuantity(lines, 1, Number.POSITIVE_INFINITY)[0].quantity).toBe(1);
  });

  it("does not mutate its input", () => {
    setOrderLineQuantity(lines, 1, 9);
    expect(lines[0].quantity).toBe(2);
  });
});

describe("removeOrderLine", () => {
  it("removes only the given product", () => {
    const lines = [{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }];
    expect(removeOrderLine(lines, 1)).toEqual([{ productId: 5, quantity: 1 }]);
    expect(removeOrderLine(lines, 99)).toEqual(lines);
  });
});

describe("filterPickerProducts", () => {
  const products = [
    { id: 1, name: "Strip 2 pose", description: "Dua pose", kind: "PRINT" as const },
    { id: 2, name: "Kaos Poosefilm", description: null, kind: "MERCH" as const },
    { id: 3, name: "Polaroid", description: "Cetak instan", kind: "PRINT" as const },
  ];

  it("returns everything, in order, when nothing is filtered", () => {
    expect(filterPickerProducts(products, { q: "", kind: "" })).toEqual(products);
    expect(filterPickerProducts(products, { q: "   ", kind: "" })).toEqual(products);
  });

  it("searches the name and the description case-insensitively", () => {
    expect(filterPickerProducts(products, { q: "KAOS", kind: "" }).map((product) => product.id)).toEqual([2]);
    expect(filterPickerProducts(products, { q: "instan", kind: "" }).map((product) => product.id)).toEqual([3]);
    expect(filterPickerProducts(products, { q: "  pose ", kind: "" }).map((product) => product.id)).toEqual([1]);
  });

  it("filters by kind and treats an unknown kind as all kinds", () => {
    expect(filterPickerProducts(products, { q: "", kind: "PRINT" }).map((product) => product.id)).toEqual([1, 3]);
    expect(filterPickerProducts(products, { q: "", kind: "MERCH" }).map((product) => product.id)).toEqual([2]);
    expect(filterPickerProducts(products, { q: "", kind: "ALL" })).toEqual(products);
  });

  it("combines search and kind", () => {
    expect(filterPickerProducts(products, { q: "po", kind: "MERCH" }).map((product) => product.id)).toEqual([2]);
    expect(filterPickerProducts(products, { q: "po", kind: "PRINT" }).map((product) => product.id)).toEqual([1, 3]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/order-lines.test.ts`
Expected: FAIL, cannot resolve `~/utils/order-lines`.

- [ ] **Step 3: Implement**

Create `app/utils/order-lines.ts`:

```ts
import { isProductKind, type ProductKind } from "~/utils/product-kind";

export type OrderLine = { productId: number; quantity: number };

/** Appends the product with quantity 1, or adds 1 to its existing line. */
export function addOrderLine(lines: OrderLine[], productId: number): OrderLine[] {
  if (lines.some((line) => line.productId === productId)) {
    return lines.map((line) => (line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line));
  }
  return [...lines, { productId, quantity: 1 }];
}

/** Sets a line's quantity, floored and clamped to at least 1; a line is only removed with removeOrderLine. */
export function setOrderLineQuantity(lines: OrderLine[], productId: number, quantity: number): OrderLine[] {
  const next = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
  return lines.map((line) => (line.productId === productId ? { ...line, quantity: next } : line));
}

export function removeOrderLine(lines: OrderLine[], productId: number): OrderLine[] {
  return lines.filter((line) => line.productId !== productId);
}

type PickerProduct = { name: string; description: string | null; kind: ProductKind };

/** Filters products for the picker popup; an unknown kind means all kinds, and the input order is kept. */
export function filterPickerProducts<T extends PickerProduct>(products: T[], { q, kind }: { q: string; kind: string }): T[] {
  const search = q.trim().toLowerCase();
  return products.filter((product) => {
    if (isProductKind(kind) && product.kind !== kind) return false;
    if (!search) return true;
    return product.name.toLowerCase().includes(search) || (product.description ?? "").toLowerCase().includes(search);
  });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all pass (the new file adds 11 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add app/utils/order-lines.ts tests/order-lines.test.ts
git commit -m "feat: add pure order-line and picker filter helpers" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Picker popup and SettingsModal options

**Files:**
- Create: `tests/product-picker.test.ts`, `app/components/ProductPickerModal.tsx`
- Modify: `app/components/SettingsModal.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/product-picker.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("SettingsModal options used by the picker", () => {
  it("has an optional eyebrow that defaults to the old text and a data-autofocus hook", () => {
    const modal = source("app/components/SettingsModal.tsx");
    expect(modal).toContain('eyebrow = "Poosefilm settings"');
    expect(modal).toContain("{eyebrow}");
    expect(modal).toContain("[data-autofocus]");
  });
});

describe("product picker popup", () => {
  it("searches, filters by kind, adds on click, and closes with Selesai", () => {
    const picker = source("app/components/ProductPickerModal.tsx");
    expect(picker).toContain('eyebrow="KASIR"');
    expect(picker).toContain("filterPickerProducts");
    expect(picker).toContain("data-autofocus");
    expect(picker).toContain("onAdd(product.id)");
    expect(picker).toContain("Tidak ada product yang cocok.");
    expect(picker).toContain("Selesai");
  });

  it("never renders a submit button, so it cannot submit a surrounding form", () => {
    const picker = source("app/components/ProductPickerModal.tsx");
    expect(picker).not.toContain('type="submit"');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-picker.test.ts`
Expected: FAIL (`ProductPickerModal.tsx` does not exist, `SettingsModal` has no `eyebrow`).

- [ ] **Step 3: Update `app/components/SettingsModal.tsx`**

`SettingsModal.tsx` is written in dense one-line JSX. Use the Read tool, then the Edit tool with these exact replacements (each `old_string` occurs once):

1. Replace

```tsx
export function SettingsModal({ title, description, open, onClose, children }: { title: string; description?: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
```

with

```tsx
export function SettingsModal({ title, description, eyebrow = "Poosefilm settings", open, onClose, children }: { title: string; description?: string; eyebrow?: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
```

2. Replace

```tsx
    closeButtonRef.current?.focus();
```

with

```tsx
    (dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? closeButtonRef.current)?.focus();
```

3. Replace `<section className="flex max-h-[min(880px,92vh)]` with `<section ref={dialogRef} className="flex max-h-[min(880px,92vh)]`.

4. Replace `>Poosefilm settings</p>` with `>{eyebrow}</p>`.

- [ ] **Step 4: Create `app/components/ProductPickerModal.tsx`**

```tsx
import { useState } from "react";

import { SettingsModal } from "~/components/SettingsModal";
import { filterPickerProducts, type OrderLine } from "~/utils/order-lines";
import { PRODUCT_KINDS, PRODUCT_KIND_LABELS, PRODUCT_KIND_PILL_CLASSES, type ProductKind } from "~/utils/product-kind";

type PickerProduct = { id: number; name: string; description: string | null; price: number; kind: ProductKind };

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const KIND_CHIPS: Array<{ value: ProductKind | ""; label: string }> = [
  { value: "", label: "Semua" },
  ...PRODUCT_KINDS.map((value) => ({ value, label: PRODUCT_KIND_LABELS[value] })),
];

export function ProductPickerModal({ products, lines, onAdd, onClose }: { products: PickerProduct[]; lines: OrderLine[]; onAdd: (productId: number) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<ProductKind | "">("");
  const visibleProducts = filterPickerProducts(products, { q, kind });
  const quantityByProductId = new Map(lines.map((line) => [line.productId, line.quantity]));
  return (
    <SettingsModal open eyebrow="KASIR" title="Tambah product" description="Klik product untuk menambahkannya ke order. Klik lagi untuk menambah jumlahnya." onClose={onClose}>
      <div className="space-y-4">
        <input className="field-input" data-autofocus value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari nama atau keterangan..." aria-label="Cari product" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tipe">
          {KIND_CHIPS.map((chip) => (
            <button key={chip.value || "all"} type="button" aria-pressed={kind === chip.value} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${kind === chip.value ? "border-[#25231f] bg-[#25231f] text-white" : "border-[#ded5ca] bg-white text-[#62594f] hover:border-[#25231f]"}`} onClick={() => setKind(chip.value)}>{chip.label}</button>
          ))}
        </div>
        {visibleProducts.length ? (
          <ul className="max-h-[50vh] divide-y divide-[#eee7df] overflow-y-auto rounded-xl border border-[#e6ded2]">
            {visibleProducts.map((product) => {
              const quantityInOrder = quantityByProductId.get(product.id);
              return (
                <li key={product.id}>
                  <button type="button" className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-[#faf7f1]" onClick={() => onAdd(product.id)}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#1f2528]">
                        {product.name}
                        <span className={`status-pill ${PRODUCT_KIND_PILL_CLASSES[product.kind]}`}>{PRODUCT_KIND_LABELS[product.kind]}</span>
                      </span>
                      {product.description ? <span className="mt-1 block text-xs text-[#84796c]">{product.description}</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-sm">
                      {quantityInOrder ? <span className="rounded-full bg-[#25231f] px-2 py-0.5 text-[10px] font-semibold text-white">x{quantityInOrder}</span> : null}
                      <span className="text-[#667177]">{rupiah.format(product.price)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-[#d9d0c4] p-6 text-center text-sm text-[#968b7e]">Tidak ada product yang cocok.</p>
        )}
        <div className="flex justify-end">
          <button className="button-primary" type="button" onClick={onClose}>Selesai</button>
        </div>
      </div>
    </SettingsModal>
  );
}
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npx eslint --ext .ts,.tsx app/components/SettingsModal.tsx app/components/ProductPickerModal.tsx`
Expected: all pass, typecheck clean, eslint prints nothing. `tests/settings-ui.test.ts` (which reads `admin.settings.tsx` for `SettingsModal`) must still pass.

- [ ] **Step 6: Commit**

```bash
git add app/components/SettingsModal.tsx app/components/ProductPickerModal.tsx tests/product-picker.test.ts
git commit -m "feat: add the product picker popup" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Cashier order list and popup

The popup is rendered OUTSIDE the cashier `<Form>`: it contains a text input, and pressing Enter there would otherwise submit the order.

**Files:**
- Modify: `tests/product-ui.test.ts`
- Modify: `app/routes/admin.cashier.tsx`

- [ ] **Step 1: Update the tests first**

In `tests/product-ui.test.ts`, inside `describe("cashier and receipt use product items", ...)`, replace the test `renders one quantity input per active product` with:

```ts
  it("builds the order from a product picker and posts one quantity per line", () => {
    const cashier = source("app/routes/admin.cashier.tsx");
    expect(cashier).toContain("listActiveProducts");
    expect(cashier).toContain("ProductPickerModal");
    expect(cashier).toContain("+ Tambah product");
    expect(cashier).toContain("useState<OrderLine[]>");
    expect(cashier).toContain("orderLines.map");
    expect(cashier).toContain("name={`qty_${product.id}`}");
    expect(cashier).toContain("parseOrderItemFields");
    expect(cashier).not.toContain('name="quantity"');
  });

  it("renders the picker outside the order form so Enter in its search box cannot submit the order", () => {
    const cashier = source("app/routes/admin.cashier.tsx");
    expect(cashier.indexOf("</Form>")).toBeGreaterThan(-1);
    expect(cashier.indexOf("<ProductPickerModal")).toBeGreaterThan(cashier.indexOf("</Form>"));
  });
```

Keep the other tests in that describe unchanged.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/product-ui.test.ts`
Expected: FAIL on the two new tests (`ProductPickerModal` and `+ Tambah product` are not in the cashier yet).

- [ ] **Step 3: Replace `app/routes/admin.cashier.tsx`**

Replace the whole file with:

```tsx
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
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

import { ProductPickerModal } from '~/components/ProductPickerModal';
import { Receipt } from '~/components/Receipt';
import { requireUser } from '~/services/auth.server';
import { createOrder, parseOptionalFilterPackageId, serializeReceiptOrder } from '~/services/orders.server';
import { getActiveFilterPackages } from '~/services/filter-packages.server';
import { listActiveProducts } from '~/services/products.server';
import { calculateOrderTotal, countPrintQuantity, parseOrderItemFields } from '~/utils/order-items';
import { addOrderLine, removeOrderLine, setOrderLineQuantity, type OrderLine } from '~/utils/order-lines';
import { PRODUCT_KIND_LABELS, PRODUCT_KIND_PILL_CLASSES } from '~/utils/product-kind';

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
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isRealTransaction, setIsRealTransaction] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const order = actionData && 'order' in actionData ? actionData.order : null;
  const qrDataUrl =
    actionData && 'qrDataUrl' in actionData ? actionData.qrDataUrl : null;
  const error = actionData && 'error' in actionData ? actionData.error : null;
  const productsById = new Map(products.map((product) => [product.id, product]));
  const orderLines = lines.flatMap((line) => {
    const product = productsById.get(line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  const items = orderLines.map(({ product, quantity }) => ({
    unitPrice: product.price,
    quantity,
    productKind: product.kind,
  }));
  const printQuantity = countPrintQuantity(items);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  useEffect(() => {
    if (order?.code) {
      setLines([]);
      setPickerOpen(false);
      setIsRealTransaction(true);
      setMarketingConsent(false);
    }
  }, [order?.code]);
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
              <div className="flex items-center justify-between gap-3">
                <legend className="field-label">Product</legend>
                <button
                  className="button-secondary text-xs"
                  type="button"
                  onClick={() => setPickerOpen(true)}
                >
                  + Tambah product
                </button>
              </div>
              {orderLines.length ? (
                <div className="mt-2 divide-y divide-[#eee7df] rounded-xl border border-[#e6ded2]">
                  {orderLines.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-4"
                    >
                      <input
                        type="hidden"
                        name={`qty_${product.id}`}
                        value={quantity}
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {product.name}
                          <span className={`status-pill ${PRODUCT_KIND_PILL_CLASSES[product.kind]}`}>
                            {PRODUCT_KIND_LABELS[product.kind]}
                          </span>
                        </p>
                        <p className="text-xs text-[#968b7e]">
                          {rupiah.format(product.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <button
                            className="button-secondary !px-3 !py-2"
                            type="button"
                            aria-label={`Kurangi ${product.name}`}
                            disabled={quantity <= 1}
                            onClick={() =>
                              setLines((current) =>
                                setOrderLineQuantity(current, product.id, quantity - 1)
                              )
                            }
                          >
                            -
                          </button>
                          <input
                            className="field-input !mt-0 w-16 text-center"
                            type="number"
                            min="1"
                            step="1"
                            value={quantity}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) =>
                              setLines((current) =>
                                setOrderLineQuantity(current, product.id, Number(event.target.value))
                              )
                            }
                            aria-label={`Jumlah ${product.name}`}
                          />
                          <button
                            className="button-secondary !px-3 !py-2"
                            type="button"
                            aria-label={`Tambah jumlah ${product.name}`}
                            onClick={() =>
                              setLines((current) =>
                                setOrderLineQuantity(current, product.id, quantity + 1)
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                        <p className="w-28 text-right text-sm font-semibold">
                          {rupiah.format(product.price * quantity)}
                        </p>
                        <button
                          className="text-xs font-semibold text-[#a34e43]"
                          type="button"
                          aria-label={`Hapus ${product.name}`}
                          onClick={() =>
                            setLines((current) => removeOrderLine(current, product.id))
                          }
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-[#d9d0c4] p-4 text-sm text-[#968b7e]">
                  {products.length
                    ? 'Belum ada product. Klik + Tambah product.'
                    : 'Belum ada product aktif. Minta superadmin menambahkannya di halaman Produk.'}
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
                {printQuantity} cetak
              </p>
            </div>
            <button
              className="button-primary"
              type="submit"
              disabled={navigation.state === 'submitting' || orderLines.length === 0}
            >
              {navigation.state === 'submitting'
                ? 'Memproses...'
                : 'Proses pembayaran'}
            </button>
          </div>
          {orderLines.length === 0 ? (
            <p className="mt-4 text-sm text-[#968b7e]">
              Tambah minimal satu product.
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        </Form>
        {pickerOpen ? (
          <ProductPickerModal
            products={products}
            lines={lines}
            onAdd={(productId) =>
              setLines((current) => addOrderLine(current, productId))
            }
            onClose={closePicker}
          />
        ) : null}
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

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run && npm run typecheck && npx eslint --ext .ts,.tsx app/routes/admin.cashier.tsx`
Expected: all pass, typecheck clean, eslint prints nothing. The assertions in `tests/public-order.test.ts` (`name="isRealTransaction"`, `name="marketingConsent"`, `isRealTransaction`), `tests/filter-packages.test.ts` (`getActiveFilterPackages`, `name="filterPackageId"`) and the remaining `tests/product-ui.test.ts` cashier tests (`countPrintQuantity`, `PRODUCT_KIND_LABELS[product.kind]`, `halaman Produk`) must still pass.

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin.cashier.tsx tests/product-ui.test.ts
git commit -m "feat: add products to the cashier order through a popup" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full automated check**

Run: `npm run typecheck && npx vitest run && npx eslint --ext .ts,.tsx app tests && npm run build`
Expected: typecheck clean, all tests pass, 0 eslint errors (the 2 pre-existing warnings in `WebcamRecorder.tsx` and `admin.tsx` are fine), build succeeds. Report any failure verbatim.

- [ ] **Step 2: Hand-off checklist for the owner (needs a login, done by the user)**

There is no migration this time. After restarting `npm run dev`:

1. Kasir opens with an empty Product block ("Belum ada product. Klik + Tambah product."), "Proses pembayaran" disabled with "Tambah minimal satu product."
2. Click "+ Tambah product": the popup shows "KASIR" and "Tambah product", the search box is focused, chips Semua/Cetak/Merch, and all active products.
3. Click a product: the popup stays open, the product appears in the order behind it, and its row shows `x1`. Click it again: `x2`. Click another product: it is added below the first.
4. Search by name and by a word from a description; use the Cetak and Merch chips; a search with no match shows "Tidak ada product yang cocok."
5. Press Enter inside the search box: nothing is submitted. Close with Selesai, the x button, or Escape.
6. In the order list: the minus and plus buttons change the quantity (minus is disabled at 1), typing a number works (clicking the field selects it), clearing the field snaps to 1, "Hapus" removes the line. Subtotal per line, "Total bayar" and "N cetak" (prints only) update.
7. Turn off "Transaksi real": line subtotals still show, "Total bayar" becomes Rp0.
8. Process an order with two products (one Merch): the receipt lists both lines; the form and the order list reset afterwards.
9. Rekap: "Total cetak real" counts only the print lines.
10. Product picker on a narrow window (tablet width): the popup and the order lines wrap without horizontal scrolling.

---

## Self-Review

**Spec coverage**
- UI only, same `qty_<productId>` posted fields, server unchanged: Task 3 (hidden inputs; `action`, loader, `createOrder` untouched).
- Click adds with quantity 1 or increments, popup stays open, closes with Selesai/×/Escape: Tasks 1 (`addOrderLine`), 2 (popup, `SettingsModal` handles × and Escape), 3 (`onAdd`).
- Quantity changed in the order list, minimum 1, removed only with its button: Tasks 1 (`setOrderLineQuantity`, `removeOrderLine`), 3 (stepper, input, Hapus).
- Client-side search and kind filter over loaded products; name and description; unknown kind means all: Task 1 (`filterPickerProducts`), Task 2 (popup).
- `SettingsModal` optional `eyebrow` with the old default, popup passes "KASIR": Task 2.
- Lines keep insertion order: `addOrderLine` appends; Task 3 renders `lines` in order.
- Order list contents (name, kind tag, unit price, minus/input/plus, subtotal, remove), empty state, submit disabled with hint, footer "N cetak" print-only, reset after success: Task 3.
- Free orders: subtotals still shown, total Rp0: Task 3 (`rupiah.format(product.price * quantity)` unconditional; total via `calculateOrderTotal(items, isRealTransaction)`).
- Popup resets search and chip on each open: Task 2 (the popup component unmounts when closed because Task 3 renders it conditionally, so its state is fresh).
- Badge `x<quantity>` for products already in the order: Task 2.
- Search box auto-focused: Task 2 (`data-autofocus` plus the `SettingsModal` hook).
- Tests listed in the spec: pure (Task 1), source-content (Tasks 2, 3), existing cashier assertions adapted (Task 3).

**Additions beyond the spec (both small):** the `data-autofocus` hook in `SettingsModal` (needed so "auto-focused" actually works, because the modal otherwise focuses its close button on open), and `onFocus` select on the quantity input (so typing replaces the value instead of appending after the snap-to-1 rule).

**Type consistency:** `OrderLine { productId, quantity }` is used by `order-lines.ts`, `ProductPickerModal` (`lines`), and the cashier `lines` state. `filterPickerProducts<T extends PickerProduct>` accepts the loader's serialized products (`kind` is the `ProductKind` union, `description` is `string | null`). `PickerProduct` in the popup matches the same fields plus `id` and `price`. The cashier `items` keep the `{ unitPrice, quantity, productKind }` shape that `calculateOrderTotal` and `countPrintQuantity` already take.
