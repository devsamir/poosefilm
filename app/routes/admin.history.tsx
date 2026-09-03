import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";

import { requireUser } from "~/services/auth.server";
import { listDeliveredOrders } from "~/services/reports.server";
import { MediaGallery } from "~/components/MediaGallery";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const url = new URL(request.url);
  return json({ orders: await listDeliveredOrders(url.searchParams.get("q") || "") });
}

export default function HistoryPage() {
  const { orders } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">OPERASIONAL</p><h1 className="page-title">Riwayat order</h1><p className="page-subtitle">Order yang sudah selesai dan link hasilnya telah tersedia.</p></div><Form method="get" className="flex gap-2"><input className="field-input min-w-64" name="q" defaultValue={searchParams.get("q") || ""} placeholder="Cari nama, kode, nomor HP..." /><button className="button-secondary" type="submit">Cari</button></Form></div>{orders.length ? <div className="grid gap-4">{orders.map((order) => <section key={order.id} className="rounded-2xl border border-[#e6ded2] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold">{order.customerName}</p><p className="mt-1 text-sm text-[#84796c]">{order.code} - {order.whatsapp}</p></div><div className="flex flex-wrap items-center justify-end gap-3 text-right"><div><p className="text-sm font-semibold">{order._count.files} file</p><p className="mt-1 text-xs text-[#968b7e]">{new Date(order.createdAt).toLocaleString("id-ID")}</p></div><Link className="button-secondary text-xs" to={`/admin/receipt/${order.code}`}>Cetak receipt</Link></div></div>{order.files.length ? <div className="mt-5"><MediaGallery code={order.code} files={order.files} variant="compact" canDelete /></div> : null}</section>)}</div> : <div className="rounded-2xl border border-dashed border-[#d9d0c4] p-12 text-center text-sm text-[#968b7e]">Belum ada order selesai.</div>}</div>;
}
