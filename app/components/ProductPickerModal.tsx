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
        <input className="field-input !mt-0" data-autofocus value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari nama atau keterangan..." aria-label="Cari product" />
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
