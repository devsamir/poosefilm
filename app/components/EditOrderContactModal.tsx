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
        <button className="button-secondary text-xs" type="button" onClick={onClose} disabled={saving}>Tutup</button>
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
