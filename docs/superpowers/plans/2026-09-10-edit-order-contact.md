# Edit Order Contact Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff correct a wrong customer name or WhatsApp number on an existing order from the Antrian (`/admin/queue`) and Riwayat (`/admin/history`) pages, closing the gap left by the earlier fix that stopped invalid WhatsApp numbers from crashing those pages.

**Architecture:** One shared `EditOrderContactModal` component (using a Remix `useFetcher`, scoped to its own submission so it can't be closed by unrelated page polling) is rendered from both route files. Each route's existing `action` gets a new `intent === "edit-contact"` branch that calls a new `updateOrderContact` service function, which reuses the same validation helper (`validateContactInput`) that order creation already uses.

**Tech Stack:** Remix (`@remix-run/react` `useFetcher`), Prisma, Vitest.

**Deviation from the approved spec** (`docs/superpowers/specs/2026-09-10-edit-order-contact-design.md`): the spec said errors would show in a page-level banner via `useActionData`. This plan instead shows errors inside the modal via `useFetcher`'s own `data`/`state`, and does not add a page-level banner to `admin.queue.tsx`. Reason found while mapping out the exact code: `admin.queue.tsx` polls `revalidator.revalidate()` every 3s while any order is processing, and a page-level "close modal when the last action had no error" effect would trigger on that unrelated polling and auto-close the modal while someone is mid-edit. A fetcher is self-contained (its own `state`/`data`, untouched by loader revalidation or other submissions), which avoids that bug entirely and is simpler than hand-rolling a fix. Field/access/entry-point decisions are unchanged.

---

## Task 1: Shared contact validation + `updateOrderContact` service function

**Files:**
- Modify: `app/services/orders.server.ts:1-25` (imports + `validateOrderInput`)
- Test: `tests/orders.test.ts`

- [ ] **Step 1: Add a test for the whatsapp-must-have-digits rule**

This rule already exists in `validateOrderInput` (added in the earlier queue-crash fix), so this test should pass immediately — it's here to lock the behavior in before the refactor in Step 3 touches this function. Add to `tests/orders.test.ts`, inside the existing `describe('order creation', ...)` block, as a new `it` alongside `'validates customer details and quantity'`:

```ts
  it('rejects a WhatsApp number with no digits', () => {
    expect(() =>
      validateOrderInput({
        customerName: 'Husein',
        whatsapp: '-',
        quantity: '1',
      })
    ).toThrow();
  });
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `npx vitest run tests/orders.test.ts`
Expected: PASS (4 tests in the file)

- [ ] **Step 3: Extract `validateContactInput` and refactor `validateOrderInput` to use it**

In `app/services/orders.server.ts`, replace:

```ts
export function validateOrderInput(input: { customerName: string; whatsapp: string; quantity: string }) {
  const customerName = input.customerName.trim();
  const whatsapp = input.whatsapp.trim();
  const quantity = Number(input.quantity);
  if (!customerName || !whatsapp || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Nama, nomor WhatsApp, dan jumlah cetak wajib valid.");
  }
  if (!normalizeWhatsappNumber(whatsapp)) {
    throw new Error("Nomor WhatsApp harus berisi angka yang valid.");
  }
  return { customerName, whatsapp, quantity };
}
```

with:

```ts
function validateContactInput(input: { customerName: string; whatsapp: string }) {
  const customerName = input.customerName.trim();
  const whatsapp = input.whatsapp.trim();
  if (!customerName) throw new Error("Nama wajib diisi.");
  if (!normalizeWhatsappNumber(whatsapp)) throw new Error("Nomor WhatsApp harus berisi angka yang valid.");
  return { customerName, whatsapp };
}

export function validateOrderInput(input: { customerName: string; whatsapp: string; quantity: string }) {
  const { customerName, whatsapp } = validateContactInput(input);
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Jumlah cetak wajib valid.");
  }
  return { customerName, whatsapp, quantity };
}
```

- [ ] **Step 4: Run the full orders test file to confirm no regression**

Run: `npx vitest run tests/orders.test.ts`
Expected: PASS (4 tests) — same as Step 2, confirming the refactor didn't change observable behavior.

- [ ] **Step 5: Add `updateOrderContact`**

Add this new exported function to `app/services/orders.server.ts`, directly below `markOrderDelivered`:

```ts
export async function updateOrderContact(id: number, input: { customerName: string; whatsapp: string }) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error("Order tidak ditemukan.");
  const details = validateContactInput(input);
  return prisma.order.update({ where: { id }, data: { customerName: details.customerName, whatsapp: details.whatsapp } });
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/services/orders.server.ts tests/orders.test.ts
git commit -m "$(cat <<'EOF'
feat: add updateOrderContact and share contact validation

Extracts validateContactInput out of validateOrderInput so order
creation and the upcoming edit-order-contact feature enforce the
exact same name/whatsapp rules, and adds updateOrderContact to
persist a corrected name/whatsapp on an existing order.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `EditOrderContactModal` component

**Files:**
- Create: `app/components/EditOrderContactModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";

type EditableOrder = {
  id: number;
  code: string;
  customerName: string;
  whatsapp: string;
};

export function EditOrderContactModal({ order, onClose }: { order: EditableOrder; onClose: () => void }) {
  const fetcher = useFetcher<{ error?: string }>();
  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && !fetcher.data.error) onClose();
  }, [fetcher.state, fetcher.data, onClose]);

  return <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#25231f]/40 p-6" role="dialog" aria-modal="true" aria-labelledby={`edit-contact-title-${order.code}`}>
    <div className="w-full max-w-md rounded-2xl border border-[#e6ded2] bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">EDIT ORDER</p>
          <h2 className="mt-2 font-display text-2xl" id={`edit-contact-title-${order.code}`}>Edit data customer</h2>
          <p className="mt-2 text-sm text-[#84796c]">Order {order.code}</p>
        </div>
        <button className="button-secondary text-xs" type="button" onClick={onClose}>Tutup</button>
      </div>
      <fetcher.Form method="post" className="mt-4 space-y-3">
        <input type="hidden" name="intent" value="edit-contact" />
        <input type="hidden" name="id" value={order.id} />
        <div>
          <label className="block text-xs text-[#84796c]" htmlFor={`edit-name-${order.code}`}>Nama customer</label>
          <input id={`edit-name-${order.code}`} name="customerName" className="field-input" defaultValue={order.customerName} required />
        </div>
        <div>
          <label className="block text-xs text-[#84796c]" htmlFor={`edit-whatsapp-${order.code}`}>Nomor WhatsApp</label>
          <input id={`edit-whatsapp-${order.code}`} name="whatsapp" className="field-input" defaultValue={order.whatsapp} required />
        </div>
        {fetcher.data?.error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{fetcher.data.error}</p> : null}
        <div className="flex justify-end gap-3 pt-2">
          <button className="button-secondary text-xs" type="button" onClick={onClose} disabled={saving}>Batal</button>
          <button className="button-primary text-xs" type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </fetcher.Form>
    </div>
  </div>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/components/EditOrderContactModal.tsx
git commit -m "$(cat <<'EOF'
feat: add EditOrderContactModal component

Shared modal for editing an order's customer name/whatsapp from
either the Antrian or Riwayat pages. Uses useFetcher so it is not
affected by unrelated page-level revalidation (e.g. the queue
page's 3s polling for processing orders).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire the modal into Antrian (`admin.queue.tsx`)

**Files:**
- Modify: `app/routes/admin.queue.tsx`

- [ ] **Step 1: Add the import**

Change:

```ts
import { markOrderDelivered } from "~/services/orders.server";
```

to:

```ts
import { markOrderDelivered, updateOrderContact } from "~/services/orders.server";
```

Add, alongside the other component imports:

```ts
import { EditOrderContactModal } from "~/components/EditOrderContactModal";
```

- [ ] **Step 2: Add the `edit-contact` branch to the action**

Replace:

```ts
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  if (String(formData.get("intent")) === "delivered") {
    try { await markOrderDelivered(Number(formData.get("id"))); } catch (error) { return json({ error: error instanceof Error ? error.message : "Order belum dapat diselesaikan." }, { status: 400 }); }
  }
  return json({ success: true, userId: user.id });
}
```

with:

```ts
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));
  if (intent === "delivered") {
    try { await markOrderDelivered(Number(formData.get("id"))); } catch (error) { return json({ error: error instanceof Error ? error.message : "Order belum dapat diselesaikan." }, { status: 400 }); }
  }
  if (intent === "edit-contact") {
    try {
      await updateOrderContact(Number(formData.get("id")), {
        customerName: String(formData.get("customerName") || ""),
        whatsapp: String(formData.get("whatsapp") || ""),
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Gagal menyimpan perubahan." }, { status: 400 });
    }
  }
  return json({ success: true, userId: user.id });
}
```

- [ ] **Step 3: Add `editingOrderCode` state next to the existing `recordingOrderCode` state**

Change:

```tsx
  const [recordingOrderCode, setRecordingOrderCode] = useState<string | null>(null);
  const recordingOrder = orders.find((order) => order.code === recordingOrderCode);
```

to:

```tsx
  const [recordingOrderCode, setRecordingOrderCode] = useState<string | null>(null);
  const recordingOrder = orders.find((order) => order.code === recordingOrderCode);
  const [editingOrderCode, setEditingOrderCode] = useState<string | null>(null);
  const editingOrder = orders.find((order) => order.code === editingOrderCode);
```

- [ ] **Step 4: Add the "Edit" button**

Change:

```tsx
            <button className="button-secondary" type="button" onClick={() => setRecordingOrderCode(order.code)} disabled={orderUploading}>
              {orderUploading ? "Upload berjalan..." : "Rekam webcam"}
            </button>
```

to:

```tsx
            <button className="button-secondary" type="button" onClick={() => setRecordingOrderCode(order.code)} disabled={orderUploading}>
              {orderUploading ? "Upload berjalan..." : "Rekam webcam"}
            </button>
            <button className="button-secondary" type="button" onClick={() => setEditingOrderCode(order.code)}>Edit</button>
```

- [ ] **Step 5: Render the modal next to `WebcamRecorder`**

Change:

```tsx
    {recordingOrder ? <WebcamRecorder orderCode={recordingOrder.code} customerName={recordingOrder.customerName} onClose={() => setRecordingOrderCode(null)} onUploadComplete={() => revalidator.revalidate()} /> : null}
  </div>;
```

to:

```tsx
    {recordingOrder ? <WebcamRecorder orderCode={recordingOrder.code} customerName={recordingOrder.customerName} onClose={() => setRecordingOrderCode(null)} onUploadComplete={() => revalidator.revalidate()} /> : null}
    {editingOrder ? <EditOrderContactModal order={editingOrder} onClose={() => setEditingOrderCode(null)} /> : null}
  </div>;
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/routes/admin.queue.tsx
git commit -m "$(cat <<'EOF'
feat: let staff edit order contact info from Antrian

Adds an Edit button on each queue card that opens
EditOrderContactModal, wired to a new edit-contact action branch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire the modal into Riwayat (`admin.history.tsx`)

**Files:**
- Modify: `app/routes/admin.history.tsx`

- [ ] **Step 1: Update imports**

Change:

```ts
import { canAccessSuperadmin, requireSuperadmin, requireUser } from "~/services/auth.server";
import { deleteDeliveredOrder } from "~/services/orders.server";
```

to:

```ts
import { canAccessSuperadmin, requireUser } from "~/services/auth.server";
import { deleteDeliveredOrder, updateOrderContact } from "~/services/orders.server";
```

Add, alongside the other component imports:

```ts
import { EditOrderContactModal } from "~/components/EditOrderContactModal";
```

- [ ] **Step 2: Split the action's authorization from a blanket `requireSuperadmin` to per-intent**

The current action requires superadmin for the *entire* action (including any future intent), which would wrongly block STAFF from editing contact info. Replace:

```ts
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireSuperadmin(request);
  const formData = await request.formData();
  if (String(formData.get("intent")) !== "delete") return json({ error: "Aksi tidak valid." }, { status: 400 });

  const orderId = Number(formData.get("id"));
  if (!Number.isInteger(orderId) || orderId < 1) return json({ error: "Order tidak valid." }, { status: 400 });
  try {
    await deleteDeliveredOrder(orderId, user);
    return redirect(request.url);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menghapus riwayat." }, { status: 400 });
  }
}
```

with:

```ts
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "edit-contact") {
    try {
      await updateOrderContact(Number(formData.get("id")), {
        customerName: String(formData.get("customerName") || ""),
        whatsapp: String(formData.get("whatsapp") || ""),
      });
      return redirect(request.url);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Gagal menyimpan perubahan." }, { status: 400 });
    }
  }

  if (intent !== "delete") return json({ error: "Aksi tidak valid." }, { status: 400 });

  const orderId = Number(formData.get("id"));
  if (!Number.isInteger(orderId) || orderId < 1) return json({ error: "Order tidak valid." }, { status: 400 });
  try {
    await deleteDeliveredOrder(orderId, user);
    return redirect(request.url);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menghapus riwayat." }, { status: 400 });
  }
}
```

Note: `deleteDeliveredOrder` (in `orders.server.ts:86-95`) already throws `"Hanya superadmin yang dapat menghapus riwayat."` internally via its own `canAccessSuperadmin(user)` check, so deletion is still blocked for STAFF — it now surfaces as a 400 with that Indonesian message instead of a 403, since the route no longer pre-gates the whole action with `requireSuperadmin`. `canDeleteHistory` in the loader (used to show/hide the delete button in the UI) is unchanged.

- [ ] **Step 3: Add `editingOrderCode` state**

Change:

```tsx
  const [uploadingOrderCode, setUploadingOrderCode] = useState<string | null>(null);
```

to:

```tsx
  const [uploadingOrderCode, setUploadingOrderCode] = useState<string | null>(null);
  const [editingOrderCode, setEditingOrderCode] = useState<string | null>(null);
  const editingOrder = orders.find((order) => order.code === editingOrderCode);
```

- [ ] **Step 4: Add the "Edit" button next to "Upload lagi"**

In the order card's button row, change:

```tsx
<button className="button-secondary text-xs" type="button" onClick={() => setUploadingOrderCode(order.code)}>Upload lagi</button>
```

to:

```tsx
<button className="button-secondary text-xs" type="button" onClick={() => setUploadingOrderCode(order.code)}>Upload lagi</button><button className="button-secondary text-xs" type="button" onClick={() => setEditingOrderCode(order.code)}>Edit</button>
```

- [ ] **Step 5: Render the modal at the end of the page**

Change the last two lines of the component (the pagination block followed by the closing `</div>;`):

```tsx
    {total > 0 ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#84796c]">Halaman {pagination.page} dari {pagination.totalPages} · {total} order</p>{pagination.totalPages > 1 ? <nav className="flex items-center gap-2" aria-label="Pagination riwayat"><Link className={`button-secondary text-xs ${pagination.page <= 1 ? "pointer-events-none opacity-40" : ""}`} to={historyPageHref(query, pagination.page - 1)} aria-disabled={pagination.page <= 1}>Sebelumnya</Link><Link className={`button-secondary text-xs ${pagination.page >= pagination.totalPages ? "pointer-events-none opacity-40" : ""}`} to={historyPageHref(query, pagination.page + 1)} aria-disabled={pagination.page >= pagination.totalPages}>Berikutnya</Link></nav> : null}</div> : null}
  </div>;
}
```

to:

```tsx
    {total > 0 ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#84796c]">Halaman {pagination.page} dari {pagination.totalPages} · {total} order</p>{pagination.totalPages > 1 ? <nav className="flex items-center gap-2" aria-label="Pagination riwayat"><Link className={`button-secondary text-xs ${pagination.page <= 1 ? "pointer-events-none opacity-40" : ""}`} to={historyPageHref(query, pagination.page - 1)} aria-disabled={pagination.page <= 1}>Sebelumnya</Link><Link className={`button-secondary text-xs ${pagination.page >= pagination.totalPages ? "pointer-events-none opacity-40" : ""}`} to={historyPageHref(query, pagination.page + 1)} aria-disabled={pagination.page >= pagination.totalPages}>Berikutnya</Link></nav> : null}</div> : null}
    {editingOrder ? <EditOrderContactModal order={editingOrder} onClose={() => setEditingOrderCode(null)} /> : null}
  </div>;
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/routes/admin.history.tsx
git commit -m "$(cat <<'EOF'
feat: let staff edit order contact info from Riwayat

Adds an Edit button on each history card that opens
EditOrderContactModal. The action's authorization moves from a
blanket requireSuperadmin to per-intent checks, since editing
contact info is open to all staff while deleting history stays
superadmin-only (enforced by deleteDeliveredOrder itself).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 2: Start the dev server and open `/admin/queue`**

Use the project's dev server (check `.claude/launch.json` / `package.json` `dev` script), log in as a STAFF or SUPERADMIN user, navigate to `/admin/queue`.

- [ ] **Step 3: Verify the edit flow on a queue order**

Click "Edit" on any order card. Confirm the modal opens pre-filled with that order's current name/whatsapp. Clear the whatsapp field, type `-`, click "Simpan". Confirm an error message appears inside the modal ("Nomor WhatsApp harus berisi angka yang valid.") and the modal stays open. Then type a real number (e.g. `081234567890`), click "Simpan". Confirm the modal closes, the card now shows the updated name/whatsapp, and (if the order has files) the "Kirim WA" button is enabled with the new number.

- [ ] **Step 4: Verify the edit flow on a history order**

Navigate to `/admin/history`. Repeat the same check: click "Edit" on a delivered order, confirm modal pre-fill, save a change, confirm it persists and "Kirim WA" reflects it.

- [ ] **Step 5: Verify STAFF (non-superadmin) access**

If a STAFF-role test account exists, log in as STAFF and confirm the "Edit" button and modal work on both pages, while "Hapus riwayat" on `/admin/history` remains hidden/blocked (existing `canDeleteHistory` behavior, unchanged by this plan).
