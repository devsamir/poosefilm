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
