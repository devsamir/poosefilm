# Marketing Consent Design

## Goal

Let staff record, at order creation, whether the customer allows Poosefilm to share their photos on social media, and let staff filter the Riwayat page down to only consented orders when picking photos to post.

## Decisions

- One boolean field on `Order`, set once at creation. No edit UI later — if it's wrong, staff recreate the order or it stays as recorded (same as any other one-way field captured at checkout).
- Default `false`. Existing orders become `false` via the migration's column default, with no separate backfill logic needed.
- Riwayat gets a filter toggle ("Boleh di-share aja"), not a per-card badge. Staff use it to narrow the list right before picking photos to post, rather than scanning badges manually.
- Not connected to the ZIP export feature. Consent filters the on-page list only; the existing date-range ZIP export is unaffected.

## Data model

- `Order.marketingConsent Boolean @default(false) @map("marketing_consent")`, positioned next to `isRealTransaction` in the schema (same kind of checkout-time flag).

## Cashier flow

- `app/routes/admin.cashier.tsx`: new checkbox "Boleh di-share ke sosmed Poosefilm", placed directly above the existing "Transaksi real" checkbox, same visual style (bordered label box), `useState(false)`, submitted as `marketingConsent`.
- `createOrder` (`app/services/orders.server.ts`) accepts `marketingConsent?: boolean` and stores it (`input.marketingConsent === true`, mirroring how `isRealTransaction` is normalized).

## Riwayat flow

- `app/routes/admin.history.tsx`: a checkbox next to the existing search form, reflected in the URL as `?consent=1`. Checking it re-submits the GET search form with that param set; unchecking removes it.
- `listDeliveredOrders` (`app/services/reports.server.ts`) gains an optional consent-only filter: when requested, `buildDeliveredOrdersWhere` adds `marketingConsent: true` to the Prisma `where`.

## Testing

- Pure-function test on `buildDeliveredOrdersWhere` (already covered by history-export tests) extended with a case asserting the `marketingConsent: true` clause is added only when requested, mirroring the existing date-range/search cases.
- Route/UI content-check test (matching this codebase's established convention) asserting `admin.cashier.tsx` contains the new checkbox and `admin.history.tsx` contains the consent filter control.
