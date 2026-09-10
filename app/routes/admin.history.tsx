import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useRevalidator, useSearchParams } from "@remix-run/react";
import { useState } from "react";

import { MediaGallery } from "~/components/MediaGallery";
import { MediaUploader } from "~/components/MediaUploader";
import { canAccessSuperadmin, requireSuperadmin, requireUser } from "~/services/auth.server";
import { deleteDeliveredOrder } from "~/services/orders.server";
import { listDeliveredOrders } from "~/services/reports.server";
import { getWhatsappTemplate } from "~/services/settings.server";
import { buildWhatsAppUrl } from "~/utils/whatsapp";

const HISTORY_PAGE_SIZE = 12;

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const history = await listDeliveredOrders(query, requestedPage, HISTORY_PAGE_SIZE);
  const template = await getWhatsappTemplate();
  const publicBaseUrl = process.env.PUBLIC_ORDER_BASE_URL || "http://localhost:3000";
  return json({
    orders: history.orders.map((order) => ({ ...order, whatsappUrl: buildWhatsAppUrl({ template, customerName: order.customerName, orderCode: order.code, whatsapp: order.whatsapp, publicBaseUrl }) })),
    pagination: history.pagination,
    total: history.total,
    canDeleteHistory: canAccessSuperadmin(user),
  });
}

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

function historyPageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("page", String(page));
  return `?${params.toString()}`;
}

export default function HistoryPage() {
  const actionData = useActionData<typeof action>();
  const { orders, pagination, total, canDeleteHistory } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [uploadingOrderCode, setUploadingOrderCode] = useState<string | null>(null);
  const query = searchParams.get("q") || "";
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const exportHref = exportFrom && exportTo ? `/api/history/export-zip?${new URLSearchParams({ from: exportFrom, to: exportTo, ...(query ? { q: query } : {}) }).toString()}` : undefined;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">OPERASIONAL</p><h1 className="page-title">Riwayat order</h1><p className="page-subtitle">Order yang sudah selesai dan link hasilnya telah tersedia.</p></div><Form method="get" className="flex gap-2"><input className="field-input min-w-64" name="q" defaultValue={query} placeholder="Cari nama, kode, nomor HP..." /><button className="button-secondary" type="submit">Cari</button></Form></div>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e6ded2] bg-white p-4">
      <div><label className="block text-xs text-[#84796c]" htmlFor="export-from">Dari tanggal</label><input id="export-from" type="date" className="field-input" value={exportFrom} onChange={(event) => setExportFrom(event.target.value)} /></div>
      <div><label className="block text-xs text-[#84796c]" htmlFor="export-to">Sampai tanggal</label><input id="export-to" type="date" className="field-input" value={exportTo} onChange={(event) => setExportTo(event.target.value)} /></div>
      {exportHref ? <a className="button-secondary text-xs" href={exportHref}>Download ZIP</a> : <span className="button-secondary text-xs pointer-events-none opacity-40" aria-disabled="true">Download ZIP</span>}
    </div>
    {actionData?.error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{actionData.error}</p> : null}
    {orders.length ? <div className="grid gap-4">{orders.map((order) => {
      const deleting = navigation.state === "submitting" && navigation.formData?.get("id") === String(order.id);
      return <section key={order.id} className="rounded-2xl border border-[#e6ded2] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{order.customerName}</p>{!order.isRealTransaction ? <span className="status-pill status-waiting text-[10px]">FREE</span> : null}</div><p className="mt-1 text-sm text-[#84796c]">{order.code} - {order.whatsapp}</p></div><div className="flex flex-wrap items-center justify-end gap-3 text-right"><div><p className="text-sm font-semibold">{order._count.files} file</p><p className="mt-1 text-xs text-[#968b7e]">{new Date(order.createdAt).toLocaleString("id-ID")}</p></div><button className="button-secondary text-xs" type="button" onClick={() => setUploadingOrderCode(order.code)}>Upload lagi</button>{order.whatsappUrl ? <a className="button-secondary text-xs" href={order.whatsappUrl} target="_blank" rel="noreferrer">Kirim WA</a> : <span className="button-secondary text-xs pointer-events-none opacity-40" aria-disabled="true" title="Nomor WhatsApp tidak valid, perbaiki dulu">Kirim WA</span>}<Link className="button-secondary text-xs" to={`/admin/receipt/${order.code}`}>Cetak receipt</Link>{canDeleteHistory ? <Form method="post" onSubmit={(event) => { if (!window.confirm(`Hapus riwayat order ${order.code}? Semua file hasil customer juga akan dihapus.`)) event.preventDefault(); }}><input type="hidden" name="intent" value="delete" /><input type="hidden" name="id" value={order.id} /><button className="button-secondary text-xs text-red-700" type="submit" disabled={deleting}>{deleting ? "Menghapus..." : "Hapus riwayat"}</button></Form> : null}</div></div>{order.files.length ? <div className="mt-5"><MediaGallery code={order.code} files={order.files} variant="compact" canDelete /></div> : null}{uploadingOrderCode === order.code ? <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#25231f]/40 p-6" role="dialog" aria-modal="true" aria-labelledby={`upload-title-${order.code}`}><div className="w-full max-w-lg rounded-2xl border border-[#e6ded2] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">UPLOAD TAMBAHAN</p><h2 className="mt-2 font-display text-2xl" id={`upload-title-${order.code}`}>Upload foto untuk {order.customerName}</h2><p className="mt-2 text-sm text-[#84796c]">Order {order.code}</p></div><button className="button-secondary text-xs" type="button" onClick={() => setUploadingOrderCode(null)}>Tutup</button></div><MediaUploader orderCode={order.code} accept="image/jpeg,image/png,image/webp" buttonLabel="Pilih foto" description="Format: JPG, PNG, atau WebP. Maksimal gambar 25 MB." onUploadComplete={() => revalidator.revalidate()} /></div></div> : null}</section>;
    })}</div> : <div className="rounded-2xl border border-dashed border-[#d9d0c4] p-12 text-center text-sm text-[#968b7e]">Belum ada order selesai.</div>}
    {total > 0 ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#84796c]">Halaman {pagination.page} dari {pagination.totalPages} · {total} order</p>{pagination.totalPages > 1 ? <nav className="flex items-center gap-2" aria-label="Pagination riwayat"><Link className={`button-secondary text-xs ${pagination.page <= 1 ? "pointer-events-none opacity-40" : ""}`} to={historyPageHref(query, pagination.page - 1)} aria-disabled={pagination.page <= 1}>Sebelumnya</Link><Link className={`button-secondary text-xs ${pagination.page >= pagination.totalPages ? "pointer-events-none opacity-40" : ""}`} to={historyPageHref(query, pagination.page + 1)} aria-disabled={pagination.page >= pagination.totalPages}>Berikutnya</Link></nav> : null}</div> : null}
  </div>;
}
