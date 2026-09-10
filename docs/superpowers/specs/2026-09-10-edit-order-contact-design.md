# Edit Order Contact Info Design

## Goal

Let staff correct a wrong customer name or WhatsApp number on an existing order directly from the Antrian (queue) or Riwayat (history) admin pages, without touching the database directly.

Immediate driver: `/admin/queue` was crashing with a 500 because one order had a WhatsApp number with no digits, which made `normalizeWhatsappNumber` throw inside the loader's `.map()`. That crash is already fixed separately (`normalizeWhatsappNumber`/`buildWhatsAppUrl` now return `null` instead of throwing, and the "Kirim WA" button disables itself when the number is invalid). This feature adds the missing piece: a way for staff to actually fix the bad number from the UI.

## Decisions

- **Editable fields**: `customerName` and `whatsapp` only. `quantity` is out of scope because it feeds `totalAmount`/pricing (a `snapshot` computed at creation time) and editing it would require re-deriving pricing — bigger change, not needed to solve the driving problem.
- **Access**: any authenticated staff (`STAFF` or `SUPERADMIN`), same as the existing `requireUser` gate on both routes. No extra role check — this is a routine data-correction action, not a destructive one (unlike history deletion, which stays `SUPERADMIN`-only).
- **Entry point**: an "Edit" button on every order card in both `admin.queue.tsx` and `admin.history.tsx`, opening the same modal component. No order-status restriction — a bad number can surface whether the order is still waiting or already delivered.
- **Validation**: identical rule to order creation — name must be non-empty after trim, whatsapp must normalize to at least one digit via the existing `normalizeWhatsappNumber`. `validateOrderInput` (in `orders.server.ts`) is refactored to call a new shared `validateContactInput({ customerName, whatsapp })` helper, so create and edit can never drift apart on what counts as a valid contact.

## Data flow

1. Staff clicks "Edit" on an order card. Component state (`editingOrderCode`, mirroring the existing `recordingOrderCode`/`uploadingOrderCode` pattern) opens a modal pre-filled with the order's current `customerName` and `whatsapp`.
2. Modal renders a `<Form method="post">` with hidden fields `intent=edit-contact` and `id=<order.id>`, plus text inputs for name and whatsapp.
3. The route's existing `action` (both `admin.queue.tsx` and `admin.history.tsx` already have one) gets a new branch: `if (intent === "edit-contact")` calls `updateOrderContact(id, { customerName, whatsapp })` in `orders.server.ts`.
4. `updateOrderContact`:
   - Loads the order by id; throws `"Order tidak ditemukan."` if missing.
   - Validates via `validateContactInput`.
   - `prisma.order.update({ where: { id }, data: { customerName, whatsapp } })`.
5. On success: Remix revalidates the loader (full-document action submission, standard Remix behavior — no manual `revalidator.revalidate()` needed), the card shows the corrected values, `whatsappUrl` is recomputed by the loader (now non-null if the number was the problem), modal closes.
6. On failure: action returns `json({ error }, 400)`. Page shows an error banner (same pattern `admin.history.tsx` already uses for its delete action). Modal state is left open so the user can correct and resubmit.

## UI changes

- New shared component `app/components/EditOrderContactModal.tsx`: takes `order` (code, customerName, whatsapp), `onClose`. Renders the `<Form>` described above. Used by both routes to avoid duplicating markup — the same modal shape already used for pattern (`role="dialog" aria-modal="true"`) as the existing "Upload lagi" modal in `admin.history.tsx`.
- `admin.queue.tsx`:
  - Add `editingOrderCode` state, "Edit" button next to "Rekam webcam".
  - Add error banner using `useActionData` (not currently imported/used on this page — new addition, mirroring `admin.history.tsx` line ~72).
- `admin.history.tsx`:
  - Add `editingOrderCode` state, "Edit" button next to "Upload lagi".
  - Existing `actionData?.error` banner already covers the new intent's errors — no change needed there.

## Error handling

- Empty name after trim -> `"Nama wajib diisi."`
- Whatsapp with zero digits -> `"Nomor WhatsApp harus berisi angka yang valid."` (same message `validateOrderInput` already throws today for this case)
- Order id not found (edge case: deleted concurrently by another admin) -> `"Order tidak ditemukan."`

## Testing

- `orders.server.ts`: unit tests for the refactored `validateContactInput`/`validateOrderInput` (empty name throws, whatsapp with no digits throws, valid input returns trimmed values) — extends the existing `tests/orders.test.ts` pattern. `updateOrderContact`'s Prisma call is not separately unit tested, consistent with the project's existing convention of only unit-testing pure validation logic, not DB calls.
- No new test needed for `normalizeWhatsappNumber`/`buildWhatsAppUrl` — already covered by `tests/whatsapp.test.ts` from the crash fix.
