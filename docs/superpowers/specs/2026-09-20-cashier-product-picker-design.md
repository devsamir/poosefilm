# Cashier Product Picker Design

Builds on `2026-09-19-multi-product-orders-design.md` and `2026-09-19-master-product-page-design.md`. Today the cashier page lists every active product with a quantity input. With merch and add-ons coming, that list grows, so products are added to the order through a popup instead.

## Goal

At the cashier, the order starts empty. The cashier adds products through a "+ Tambah product" popup and adjusts them in the order list, instead of seeing every product at once.

## Decisions

- UI only. The submitted form keeps the same `qty_<productId>` fields, so `createOrder`, `parseOrderItemFields`, the cashier loader and action, and every server-side rule stay unchanged.
- Clicking a product in the popup adds it to the order with quantity 1; clicking it again adds 1 to its quantity. The popup stays open until the cashier closes it.
- Quantity is changed in the order list, not in the popup. Minimum quantity is 1; a line is removed only with its remove button.
- Search and the type filter in the popup run in the browser over the active products already loaded by the cashier loader. No new request.
- The popup reuses `SettingsModal` (Escape to close, focus handling, scroll lock). `SettingsModal` gets an optional `eyebrow` prop; its default keeps the current text "Poosefilm settings", and the popup passes "KASIR".
- Order lines keep the order in which they were added.
- Out of scope: the merch-only order workflow (upload queue), keyboard shortcuts, barcode scanning, and remembering the last order lines.

## Order list on the cashier page

- The "Product" block shows the order lines and a "+ Tambah product" button (`type="button"`).
- Empty state: "Belum ada product. Klik + Tambah product."
- Each line shows: product name, kind tag (Cetak or Merch), unit price, a minus button, a number input, a plus button, the line subtotal, and a remove button.
  - The number input snaps to a minimum of 1; an empty or invalid value becomes 1.
  - For a free/test order (`isRealTransaction` off) the line subtotal is still shown as the product price times quantity, and only the "Total bayar" becomes Rp0, the same as today.
- Each line submits `<input type="hidden" name="qty_<productId>" value="<quantity>">`.
- "Proses pembayaran" is disabled while there are no lines or while submitting. The hint "Tambah minimal satu product." shows while there are no lines.
- "Total bayar" and the "N cetak" footer work as today: total from all lines, "N cetak" counts print lines only (`countPrintQuantity`).
- After a successful order the lines are cleared, together with the existing resets of the two checkboxes.

## Popup "Tambah product"

- Header: title "Tambah product", eyebrow "KASIR", close button.
- Body: a search input (auto-focused), type chips "Semua", "Cetak", "Merch", and a scrollable list of active products. Each row is a button showing name, kind tag, price, and a badge `x<quantity>` when the product is already in the order.
- No match: "Tidak ada product yang cocok."
- Footer: a "Selesai" button that closes the popup.
- The search text and type chip reset each time the popup opens.

## Pure logic (new module `app/utils/order-lines.ts`)

- `type OrderLine = { productId: number; quantity: number }`.
- `addOrderLine(lines, productId)`: appends `{ productId, quantity: 1 }`, or adds 1 to the existing line; returns a new array and does not mutate.
- `setOrderLineQuantity(lines, productId, quantity)`: sets the quantity, with a minimum of 1 (anything below 1, NaN, or a fraction is floored and clamped to 1).
- `removeOrderLine(lines, productId)`.
- `filterPickerProducts(products, { q, kind })`: `q` is trimmed and matched case-insensitively against the name and the description; `kind` is `PRINT`, `MERCH`, or anything else meaning all; the input order is kept.

## Components

- New `app/components/ProductPickerModal.tsx`: props `open`, `products` (active products), `lines`, `onAdd(productId)`, `onClose`. Holds only the search text and the chip selection.
- `app/components/SettingsModal.tsx`: optional `eyebrow` prop.
- `app/routes/admin.cashier.tsx`: replaces the `quantities` record and the all-products list with `lines` state, the order list, the "+ Tambah product" button, and the popup. It derives the items passed to `calculateOrderTotal` and `countPrintQuantity` from the lines and the loaded products.

## Testing

- Pure tests for `addOrderLine`, `setOrderLineQuantity`, `removeOrderLine`, and `filterPickerProducts`: add new, add existing increments, no mutation, order kept, quantity clamped to 1, removal, search by name and by description, case-insensitive, kind filter, unknown kind means all, whitespace-only search.
- Source-content tests: the cashier uses `ProductPickerModal`, has the "+ Tambah product" button and the hidden `name={`qty_${...}`}` inputs, and no longer renders one quantity input per active product; the popup passes the `KASIR` eyebrow; `SettingsModal` has the optional `eyebrow` prop with the existing default.
- Existing tests that assert cashier content (`tests/product-ui.test.ts`, `tests/public-order.test.ts`, `tests/filter-packages.test.ts`) are updated where they referenced the old input list.
