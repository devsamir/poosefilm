import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";

import { MediaUploader } from "~/components/MediaUploader";
import { MediaGallery } from "~/components/MediaGallery";
import { requireUser } from "~/services/auth.server";
import { listWaitingOrders } from "~/services/order-files.server";
import { markOrderDelivered } from "~/services/orders.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const url = new URL(request.url);
  return json({ orders: await listWaitingOrders(url.searchParams.get("q") || "") });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  if (String(formData.get("intent")) === "delivered") {
    try { await markOrderDelivered(Number(formData.get("id"))); } catch (error) { return json({ error: error instanceof Error ? error.message : "Order belum dapat diselesaikan." }, { status: 400 }); }
  }
  return json({ success: true, userId: user.id });
}

export default function QueuePage() {
  const { orders } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">OPERASIONAL</p><h1 className="page-title">Antrian upload</h1><p className="page-subtitle">Upload hasil foto/video ke order yang masih menunggu.</p></div><Form method="get" className="flex gap-2"><input className="field-input min-w-64" name="q" defaultValue={searchParams.get("q") || ""} placeholder="Cari nama, kode, nomor HP..." /><button className="button-secondary" type="submit">Cari</button></Form></div>{orders.length ? <div className="grid gap-4">{orders.map((order) => <section key={order.id} className="rounded-2xl border border-[#e6ded2] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><h2 className="font-semibold">{order.customerName}</h2><span className={`status-pill ${order.status === "READY" ? "status-ready" : "status-waiting"}`}>{order.status === "READY" ? "Siap dikirim" : "Menunggu upload"}</span></div><p className="mt-1 text-sm text-[#84796c]">{order.code} - {order.whatsapp}</p></div><p className="text-sm text-[#84796c]">{order._count.files} file</p></div>{order.files.length ? <MediaGallery code={order.code} files={order.files} variant="compact" canDelete /> : null}<MediaUploader orderCode={order.code} /><div className="mt-4 flex justify-end"><Form method="post"><input type="hidden" name="intent" value="delivered" /><input type="hidden" name="id" value={order.id} /><button className="button-primary" type="submit" disabled={order._count.files === 0}>Tandai selesai</button></Form></div></section>)}</div> : <div className="rounded-2xl border border-dashed border-[#d9d0c4] p-12 text-center"><p className="font-display text-2xl">Antrian kosong.</p><p className="mt-2 text-sm text-[#968b7e]">Order baru akan muncul di sini setelah pembayaran diproses.</p></div>}</div>;
}
