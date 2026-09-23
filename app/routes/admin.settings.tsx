import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";

import { FilterEditor } from "~/components/FilterEditor";
import { FilterPackageEditor } from "~/components/FilterPackageEditor";
import { SettingsModal } from "~/components/SettingsModal";
import { requireSuperadmin } from "~/services/auth.server";
import { createFilterPackage, createFilterTemplate, deleteFilterPackage, deleteFilterTemplate, listFilterPackages, listFilterTemplates, updateFilterPackage, updateFilterTemplate } from "~/services/filter-packages.server";
import { getWhatsappTemplate, updateWhatsappTemplate, validateWhatsappTemplate } from "~/services/settings.server";

function parseJson<T>(value: FormDataEntryValue | null, fallback: T) {
  try { return JSON.parse(String(value || "")) as T; } catch { return fallback; }
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperadmin(request);
  const [whatsappTemplate, filters, packages] = await Promise.all([getWhatsappTemplate(), listFilterTemplates(), listFilterPackages()]);
  return json({ whatsappTemplate, filters, packages });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperadmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  try {
    if (intent === "whatsapp-template") {
      await updateWhatsappTemplate(validateWhatsappTemplate(String(formData.get("whatsappTemplate") || "")));
      return json({ success: "Template WhatsApp berhasil disimpan." });
    }
    if (intent === "filter-create" || intent === "filter-update") {
      const input = { name: String(formData.get("name") || ""), previewColor: String(formData.get("previewColor") || "#FFFFFF"), values: parseJson(formData.get("values"), []) };
      if (intent === "filter-create") await createFilterTemplate(input);
      else await updateFilterTemplate(Number(formData.get("id")), input);
      return json({ success: "Filter berhasil disimpan." });
    }
    if (intent === "filter-delete") {
      await deleteFilterTemplate(Number(formData.get("id")));
      return json({ success: "Filter berhasil dihapus." });
    }
    if (intent === "package-create" || intent === "package-update") {
      const input = { name: String(formData.get("name") || ""), filterTemplateIds: parseJson(formData.get("filterTemplateIds"), []), isDefault: formData.get("isDefault") === "on" };
      if (intent === "package-create") await createFilterPackage(input);
      else await updateFilterPackage(Number(formData.get("id")), input);
      return json({ success: "Paket berhasil disimpan." });
    }
    if (intent === "package-delete") {
      await deleteFilterPackage(Number(formData.get("id")));
      return json({ success: "Paket berhasil dihapus." });
    }
    return json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menyimpan settings." }, { status: 400 });
  }
}

type SettingsModalState =
  | { type: "whatsapp" }
  | { type: "filter"; id?: number }
  | { type: "package"; id?: number };

export default function SettingsPage() {
  const { whatsappTemplate, filters, packages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [modal, setModal] = useState<SettingsModalState | null>(null);
  const [sampleImage, setSampleImage] = useState<File | null>(null);
  const error = actionData && "error" in actionData ? actionData.error : null;
  const success = actionData && "success" in actionData ? actionData.success : null;
  const filterOptions = filters.map((filter) => ({ id: filter.id, name: filter.name }));
  const selectedFilter = modal?.type === "filter" && modal.id ? filters.find((filter) => filter.id === modal.id) : undefined;
  const selectedPackage = modal?.type === "package" && modal.id ? packages.find((packageData) => packageData.id === modal.id) : undefined;

  useEffect(() => {
    if (success) setModal(null);
  }, [actionData]);

  return <div className="space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="eyebrow">SUPERADMIN AREA</p><h1 className="page-title">Settings</h1><p className="page-subtitle max-w-xl">Atur pesan customer dan resep visual untuk hasil foto Poosefilm.</p></div>
      <div className="rounded-full border border-[#d8e0d5] bg-[#f1f6ef] px-3 py-2 text-xs font-semibold text-[#4e684d]">Perubahan tersimpan ke database</div>
    </header>
    {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p> : null}
    {success ? <p className="rounded-2xl border border-[#d8e0d5] bg-[#f1f6ef] p-4 text-sm text-[#4e684d]" role="status">{success}</p> : null}

    <section className="grid gap-4" aria-label="Pengaturan cepat">
      <article className="settings-card"><div className="flex items-start justify-between gap-4"><div><p className="settings-label">Template WhatsApp</p><p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-[#667177]">{whatsappTemplate}</p></div><span className="settings-icon settings-icon-green">WA</span></div><button className="settings-action mt-6" type="button" onClick={() => setModal({ type: "whatsapp" })}>Edit template <span aria-hidden="true">↗</span></button></article>
    </section>

    <section className="settings-section" data-testid="filter-library">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="settings-label">Visual library</p><h2 className="mt-2 font-display text-3xl text-[#1f2528]">Master filter</h2><p className="mt-2 text-sm text-[#667177]">Resep warna yang tersedia untuk dipilih kasir.</p></div><button className="button-primary" type="button" onClick={() => setModal({ type: "filter" })}>+ Filter baru</button></div>
      {filters.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filters.map((filter) => <article key={filter.id} className="library-card"><div className="flex items-start gap-3"><span className="swatch" style={{ backgroundColor: filter.previewColor || "#ffffff" }} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold text-[#1f2528]">{filter.name}</h3><span className={`status-pill ${filter.isActive ? "status-ready" : "status-waiting"}`}>{filter.isActive ? "Aktif" : "Nonaktif"}</span></div><p className="mt-2 text-xs text-[#879197]">{filter.values.length} adjustment{filter.values.length === 1 ? "" : "s"}</p></div></div><p className="mt-4 line-clamp-2 rounded-lg bg-[#f7f4ee] px-3 py-2 font-mono text-[10px] leading-5 text-[#667177]">{filter.css}</p><div className="mt-4 flex items-center justify-between gap-3"><button className="settings-action" type="button" onClick={() => setModal({ type: "filter", id: filter.id })}>Edit</button><Form method="post" onSubmit={(event) => { if (!window.confirm(`Hapus filter ${filter.name}?`)) event.preventDefault(); }}><input type="hidden" name="intent" value="filter-delete" /><input type="hidden" name="id" value={filter.id} /><button className="text-xs font-semibold text-[#a34e43]" type="submit">Hapus</button></Form></div></article>)}</div> : <div className="empty-library mt-6"><p>Belum ada filter.</p><button className="settings-action mt-2" type="button" onClick={() => setModal({ type: "filter" })}>Buat filter pertama</button></div>}
    </section>

    <section className="settings-section" data-testid="package-library">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="settings-label">Preset workflow</p><h2 className="mt-2 font-display text-3xl text-[#1f2528]">Paket filter</h2><p className="mt-2 text-sm text-[#667177]">Gabungkan beberapa filter tanpa biaya tambahan.</p></div><button className="button-primary" type="button" onClick={() => setModal({ type: "package" })}>+ Paket baru</button></div>
      {packages.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{packages.map((packageData) => <article key={packageData.id} className="library-card"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-[#1f2528]">{packageData.name}</h3>{packageData.isDefault ? <span className="status-pill status-ready">Default</span> : null}</div><p className="mt-2 text-xs text-[#879197]">{packageData.filters.length} filter independen</p></div><span className="package-mark" aria-hidden="true">✦</span></div><div className="mt-5 flex min-h-12 flex-wrap content-start gap-2">{packageData.filters.map((filter) => <span key={filter.id} className="filter-chip">{filter.name}</span>)}</div><div className="mt-5 flex items-center justify-between gap-3"><button className="settings-action" type="button" onClick={() => setModal({ type: "package", id: packageData.id })}>Edit</button><Form method="post" onSubmit={(event) => { if (!window.confirm(`Hapus paket ${packageData.name}?`)) event.preventDefault(); }}><input type="hidden" name="intent" value="package-delete" /><input type="hidden" name="id" value={packageData.id} /><button className="text-xs font-semibold text-[#a34e43]" type="submit">Hapus</button></Form></div></article>)}</div> : <div className="empty-library mt-6"><p>Belum ada paket filter.</p><button className="settings-action mt-2" type="button" onClick={() => setModal({ type: "package" })}>Buat paket pertama</button></div>}
    </section>

    {modal?.type === "whatsapp" ? <SettingsModal open title="Template WhatsApp" description="Gunakan placeholder {customerName}, {orderCode}, dan {link}. Link wajib disertakan agar customer bisa membuka hasilnya." onClose={() => setModal(null)}><Form method="post" className="space-y-5"><input type="hidden" name="intent" value="whatsapp-template" /><textarea className="field-input min-h-52 resize-y" name="whatsappTemplate" defaultValue={whatsappTemplate} rows={8} required autoFocus /><div className="flex justify-end"><button className="button-primary" type="submit">Simpan template</button></div></Form></SettingsModal> : null}
    {modal?.type === "filter" ? <SettingsModal open title={selectedFilter ? `Edit ${selectedFilter.name}` : "Buat filter baru"} description="Atur karakter warna foto. Nilai filter disimpan sebagai resep, lalu diproses server saat dipakai order." onClose={() => setModal(null)}><FilterEditor key={selectedFilter?.id || "new-filter"} intent={selectedFilter ? "filter-update" : "filter-create"} filter={selectedFilter} submitLabel={selectedFilter ? "Simpan perubahan" : "Simpan filter"} sampleImage={sampleImage} onSampleImageChange={setSampleImage} /></SettingsModal> : null}
    {modal?.type === "package" ? <SettingsModal open title={selectedPackage ? `Edit ${selectedPackage.name}` : "Buat paket filter"} description="Pilih filter yang akan dibuat dari original image. Setiap filter menghasilkan file terpisah." onClose={() => setModal(null)}><FilterPackageEditor key={selectedPackage?.id || "new-package"} filters={filterOptions} intent={selectedPackage ? "package-update" : "package-create"} packageData={selectedPackage} submitLabel={selectedPackage ? "Simpan perubahan" : "Simpan paket"} /></SettingsModal> : null}
  </div>;
}
