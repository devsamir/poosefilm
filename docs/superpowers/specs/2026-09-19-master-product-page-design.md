# Master Product Page Design

Builds on `2026-09-19-multi-product-orders-design.md`. Owner feedback: product management should feel like a POS "add product" screen and support selling merch and add-ons later, so the product master moves to its own page with proper search and filtering, and every product is flagged as print or merch.

## Goal

A dedicated superadmin page to manage the product master (search, filter, add, edit, activate/deactivate), and a Print/Merch flag on every product that keeps the daily print count correct once merch is sold.

## Decisions

- Product type is an enum `ProductKind` (`PRINT`, `MERCH`), not a boolean, so an add-on type can be added later with a one-line migration. Existing products become `PRINT`.
- The type is snapshotted on `OrderItem` (`productKind`), like name and unit price. Changing a product's type later never changes past orders or past Rekap numbers.
- This supersedes the earlier decision "all products are prints, no flag".
- Scope of the flag now: visible and filterable on the master page, tag on cashier rows, and it limits the print counts (Rekap "Total cetak real" and the cashier "N cetak" footer) to `PRINT` items. Revenue still counts every item.
- Out of scope, next phase: an order that contains only merch still goes to the photo upload queue.
- Extra product field: an optional `description`. No SKU, category, or stock for now.
- Superadmin only, linked as "Produk" in the account menu next to Settings and Users. The primary navbar keeps its four operational areas.
- Add and edit use a modal on the same page (existing `SettingsModal`). No separate form pages.
- Filtering is server-side through URL params, matching the Riwayat pattern. No pagination for now (small catalog); it can be added later.
- Products stay non-deletable, only deactivated. The activate/deactivate action moves from the Settings card into the table row.
- The "Master product" section, its modal, and the product intents are removed from Settings so there is one place to manage products.

## Data model

- `enum ProductKind { PRINT MERCH }`.
- `Product`: add `kind ProductKind @default(PRINT)` and `description String?`.
- `OrderItem`: add `productKind ProductKind @map("product_kind")` (no schema default).

## Migration

One migration:

1. Create enum `ProductKind`.
2. `ALTER TABLE products ADD COLUMN kind ... NOT NULL DEFAULT 'PRINT'` and `ADD COLUMN description TEXT`.
3. `ALTER TABLE order_items ADD COLUMN product_kind ... NOT NULL DEFAULT 'PRINT'`, then `DROP DEFAULT`, so every existing item is backfilled as `PRINT` and future code must set the value explicitly.

## Services

- `products.server.ts`:
  - `normalizeProductInput` also takes `kind` (must be `PRINT` or `MERCH`, error otherwise) and `description` (trimmed, empty becomes null, max 255 characters).
  - Serialized products include `kind` and `description`.
  - New pure `buildProductsWhere({ q, kind, status })`: `q` matches name or description case-insensitively; `kind` is `PRINT` or `MERCH`; `status` is `ACTIVE` or `INACTIVE`. Any other value, or absent, means no filter. The URL params are `q`, `type` (for `kind`), and `status`, for example `/admin/products?q=polaroid&type=PRINT&status=ACTIVE`.
  - New `searchProducts(filters)` returns the filtered list ordered by name ascending, with the total count.
  - `listProducts()` stays unfiltered because `createOrder` needs every product to resolve items.
- `order-items.ts`: `ProductSnapshotSource` gains `kind`; `resolveOrderItems` returns `productKind`; new pure `countPrintQuantity(items)` sums quantities where `productKind` is `PRINT`.
- `orders.server.ts`: `createOrder` passes `productKind` through `items: { create: items }`. `serializeReceiptOrder` is unchanged.
- `reports.server.ts`: `totalPrints` sums `OrderItem.quantity` where `productKind = PRINT` over real orders.

## UI

- Route `app/routes/admin.products.tsx`, guarded by `requireSuperadmin` in loader and action.
  - Header with eyebrow `SUPERADMIN AREA`, title, and a "+ Tambah product" button.
  - Filter bar (GET form): search input, type select (Semua, Cetak, Merch), status select (Semua, Aktif, Nonaktif), Cari and Reset. Result count shown.
  - Table columns: Nama (description below in small text), Tipe pill, Harga, Status pill, Aksi (Edit, Nonaktifkan/Aktifkan).
  - Modal editor (`ProductEditor`): nama, harga, tipe select, deskripsi, aktif checkbox. Intents: `product-create`, `product-update`, `product-toggle`.
  - Empty states: no products at all, and no match for the current filter.
  - The table scrolls horizontally on narrow screens.
- `AccountMenu.tsx`: add a "Produk" link for superadmin, before Settings.
- `admin.settings.tsx`: remove the product section, its modal state, `ProductEditor` usage, and the product intents and imports.
- Cashier (`admin.cashier.tsx`): a small tag (Cetak or Merch) beside each product name; footer shows `countPrintQuantity` as "N cetak"; the submit button stays enabled while any item quantity is above zero.
- The success banner and modal-close pattern follow Settings (`useEffect` on `actionData`).

## Testing

- Pure tests: `normalizeProductInput` (valid kinds, invalid kind, description trim, empty to null, over-length); `buildProductsWhere` (search only, type only, status only, combined, `ALL`); `resolveOrderItems` snapshots `productKind`; `countPrintQuantity` (print only, mixed, all merch is 0).
- Source-content tests: the new route uses `requireSuperadmin`, has the filter form fields and the `product-toggle` intent; `AccountMenu` links to `/admin/products`; Settings no longer contains the product library; the reports service filters `productKind`.
- Migration: apply all migrations on a scratch database with legacy orders and check that every `order_items.product_kind` is `PRINT`, then check for drift with `prisma migrate diff`.
