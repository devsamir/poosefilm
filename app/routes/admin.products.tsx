import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState, type ChangeEvent } from "react";

import { ProductEditor } from "~/components/ProductEditor";
import { SettingsModal } from "~/components/SettingsModal";
import { requireSuperadmin } from "~/services/auth.server";
import { createProduct, searchProducts, setProductActive, updateProduct } from "~/services/products.server";
import { PRODUCT_KINDS, PRODUCT_KIND_LABELS, PRODUCT_KIND_PILL_CLASSES, isProductKind } from "~/utils/product-kind";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperadmin(request);
  const params = new URL(request.url).searchParams;
  const filters = { q: params.get("q") || "", kind: params.get("type") || "", status: params.get("status") || "" };
  return json({ products: await searchProducts(filters), filters });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperadmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  try {
    if (intent === "product-create" || intent === "product-update") {
      const input = { name: String(formData.get("name") || ""), price: String(formData.get("price") || ""), kind: String(formData.get("kind") || ""), description: String(formData.get("description") || ""), isActive: formData.get("isActive") === "on" };
      if (intent === "product-create") await createProduct(input);
      else await updateProduct(Number(formData.get("id")), input);
      return json({ success: "Product berhasil disimpan." });
    }
    if (intent === "product-toggle") {
      const isActive = formData.get("isActive") === "true";
      await setProductActive(Number(formData.get("id")), isActive);
      return json({ success: isActive ? "Product diaktifkan." : "Product dinonaktifkan." });
    }
    return json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menyimpan product." }, { status: 400 });
  }
}

const currencyFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function submitOnChange(event: ChangeEvent<HTMLSelectElement>) {
  event.currentTarget.form?.requestSubmit();
}

export default function ProductsPage() {
  const { products, filters } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [modal, setModal] = useState<{ id?: number } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const error = actionData && "error" in actionData ? actionData.error : null;
  const success = actionData && "success" in actionData ? actionData.success : null;
  const hasFilters = Boolean(filters.q.trim()) || isProductKind(filters.kind) || filters.status === "ACTIVE" || filters.status === "INACTIVE";
  const selectedProduct = modal?.id ? products.find((product) => product.id === modal.id) : undefined;

  useEffect(() => {
    if (success) setModal(null);
    setModalError(error);
  }, [actionData]);

  function openModal(next: { id?: number }) {
    setModalError(null);
    setModal(next);
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">SUPERADMIN AREA</p><h1 className="page-title">Produk</h1><p className="page-subtitle">Kelola product cetak dan merch yang dijual di kasir.</p></div>
      <button className="button-primary" type="button" onClick={() => openModal({})}>+ Tambah product</button>
    </div>
    {error && !modal ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p> : null}
    {success ? <p className="rounded-2xl border border-[#d8e0d5] bg-[#f1f6ef] p-4 text-sm text-[#4e684d]" role="status">{success}</p> : null}

    <Form method="get" key={`${filters.q}|${filters.kind}|${filters.status}`} className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e6ded2] bg-white p-4">
      <label className="field-label min-w-64 flex-1">Cari<input className="field-input" name="q" defaultValue={filters.q} placeholder="Cari nama atau keterangan..." /></label>
      <label className="field-label">Tipe<select className="field-input" name="type" defaultValue={filters.kind} onChange={submitOnChange}><option value="">Semua</option>{PRODUCT_KINDS.map((kind) => <option key={kind} value={kind}>{PRODUCT_KIND_LABELS[kind]}</option>)}</select></label>
      <label className="field-label">Status<select className="field-input" name="status" defaultValue={filters.status} onChange={submitOnChange}><option value="">Semua</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></label>
      <button className="button-secondary" type="submit">Cari</button>
      {hasFilters ? <Link className="button-secondary" to="/admin/products">Reset</Link> : null}
    </Form>

    <p className="text-sm text-[#84796c]">{products.length} product</p>

    {products.length ? <div className="overflow-x-auto rounded-2xl border border-[#e6ded2] bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[#eee7df] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a09587]"><tr><th className="px-5 py-3">Nama</th><th className="px-5 py-3">Tipe</th><th className="px-5 py-3 text-right">Harga</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead>
        <tbody className="divide-y divide-[#eee7df]">
          {products.map((product) => <tr key={product.id}>
            <td className="px-5 py-4"><p className="font-semibold text-[#1f2528]">{product.name}</p>{product.description ? <p className="mt-1 max-w-md text-xs text-[#84796c]">{product.description}</p> : null}</td>
            <td className="px-5 py-4"><span className={`status-pill ${PRODUCT_KIND_PILL_CLASSES[product.kind]}`}>{PRODUCT_KIND_LABELS[product.kind]}</span></td>
            <td className="px-5 py-4 text-right">{currencyFormatter.format(product.price)}</td>
            <td className="px-5 py-4"><span className={`status-pill ${product.isActive ? "status-ready" : "status-waiting"}`}>{product.isActive ? "Aktif" : "Nonaktif"}</span></td>
            <td className="px-5 py-4"><div className="flex items-center justify-end gap-4"><button className="settings-action" type="button" onClick={() => openModal({ id: product.id })}>Edit</button><Form method="post"><input type="hidden" name="intent" value="product-toggle" /><input type="hidden" name="id" value={product.id} /><input type="hidden" name="isActive" value={String(!product.isActive)} /><button className={`text-xs font-semibold ${product.isActive ? "text-[#a34e43]" : "text-[#4e684d]"}`} type="submit">{product.isActive ? "Nonaktifkan" : "Aktifkan"}</button></Form></div></td>
          </tr>)}
        </tbody>
      </table>
    </div> : <div className="empty-library"><p>{hasFilters ? "Tidak ada product yang cocok dengan filter." : "Belum ada product."}</p>{hasFilters ? null : <button className="settings-action mt-2" type="button" onClick={() => openModal({})}>Buat product pertama</button>}</div>}

    {modal ? <SettingsModal open title={selectedProduct ? `Edit ${selectedProduct.name}` : "Tambah product"} description="Product nonaktif tidak muncul di kasir, tapi order lama tetap menyimpan nama, tipe, dan harganya." onClose={() => setModal(null)}><>{modalError ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{modalError}</p> : null}<ProductEditor key={selectedProduct?.id || "new-product"} intent={selectedProduct ? "product-update" : "product-create"} product={selectedProduct} submitLabel={selectedProduct ? "Simpan perubahan" : "Simpan product"} /></></SettingsModal> : null}
  </div>;
}
