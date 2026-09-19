# Multi-Product Orders Design

## Goal

Replace the single global "price per print" with a master list of products. At the cashier, staff pick any mix of products and a quantity for each; the order total is the sum of the lines.

## Decisions

- All products are prints. No "is print" flag. Total prints in the daily report is the sum of all item quantities.
- The global `pricePerPrint` setting goes away. It becomes the first product ("Cetak") via migration; existing orders are backfilled with one item each. Every order then has the same data shape.
- `Order.quantity` and `Order.unitPrice` are dropped. Prints come from `OrderItem`; money stays as one `Order.totalAmount` snapshot.
- Products are never hard-deleted, only deactivated, because order items reference them.
- Item name and unit price are snapshotted on `OrderItem`. Changing a product later never changes past orders.
- Filter package stays one per order. Upload, render jobs, queue, and Riwayat are untouched.
- Free/test orders (`isRealTransaction = false`) keep their items but `totalAmount = 0`, same as today.

## Data model

- `Product`: `id`, `name` (unique), `price Decimal(12,2)`, `isActive Boolean @default(true)`, `createdAt`, `updatedAt`. Table `products`.
- `OrderItem`: `id`, `orderId` (cascade on delete), `productId` (restrict), `productName`, `unitPrice Decimal(12,2)`, `quantity Int`. `@@unique([orderId, productId])`. Table `order_items`.
- `Order`: remove `quantity`, `unitPrice`; add `items OrderItem[]`.
- `AppSetting`: remove `pricePerPrint`.

## Migration

One SQL migration, in order:

1. Create `products` and `order_items`.
2. Insert product "Cetak" with `price` from `app_settings.price_per_print` (95000 if no settings row).
3. Insert one `order_items` row per existing order: `product_name = 'Cetak'`, `unit_price = orders.unit_price`, `quantity = orders.quantity`.
4. Drop `orders.quantity`, `orders.unit_price`, `app_settings.price_per_print`.

`prisma/seed.ts` seeds the "Cetak" product instead of `pricePerPrint`.

## Services

- New `app/services/products.server.ts`: `listActiveProducts`, `listProducts`, `createProduct`, `updateProduct` (name, price, isActive). Price validation reuses the existing positive-integer rule (`validatePricePerPrint` in `users.server.ts`, renamed to `validateProductPrice`).
- `settings.server.ts`: remove `getPricePerPrint` and `updatePricePerPrint`.
- `order-invariants.ts`: `buildOrderSnapshot` takes `items: { unitPrice, quantity }[]` and returns `totalAmount` as the sum of lines (0 when not real).
- `orders.server.ts`: `validateOrderInput` takes `items: { productId, quantity }[]`. `createOrder` loads prices from the DB (never trusts the client) and creates the order and its items in one transaction. Rejected with a clear message when:
  - no item has quantity >= 1;
  - a product is missing or inactive;
  - a product appears twice.
- `reports.server.ts`: `totalPrints` = `orderItem.aggregate _sum.quantity` over real orders in the date range; revenue still `_sum.totalAmount`.

## UI

- Settings (`admin.settings.tsx`, superadmin): the "Harga per cetak" card and its price modal become a "Product" card with a manage modal (list, add, edit name/price, activate/deactivate), following the filter package pattern.
- Cashier (`admin.cashier.tsx`): one row per active product (name, price, qty input, default 0). Live total. Form posts `qty_<productId>` per product. Submit is blocked with a message when all quantities are 0.
- Receipt (`Receipt.tsx`, `admin.receipt.$code.tsx`): "Jumlah cetak" row replaced by one line per item, `name x qty` with a line subtotal. For free/test orders the subtotal is omitted so lines do not contradict the Rp0 total. Order payload carries `items` and `isRealTransaction`.

## Testing

- `order-models.test.ts`: `buildOrderSnapshot` with several items; free order gives total 0.
- `orders.test.ts`: item validation (no items, qty 0, duplicate product); `createOrder` rejects inactive product and snapshots current price.
- `products` service: create, update, deactivate; price validation.
- `reports`: `totalPrints` sums item quantities of real orders only.
- Migration: run on a copy of a DB with existing orders; check order count equals item count and every `totalAmount` is unchanged.
- Route content checks (codebase convention): cashier has per-product qty inputs; settings has the Product card and no price card.
