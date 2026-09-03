import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";

import { requireUser } from "~/services/auth.server";
import { getDailySummary } from "~/services/reports.server";

function today() { return new Date().toISOString().slice(0, 10); }

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const date = new URL(request.url).searchParams.get("date") || today();
  return json(await getDailySummary(date));
}

export default function SummaryPage() {
  const summary = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  const cards = [["Total order", summary.totalOrders], ["Total cetak", summary.totalPrints], ["Pendapatan", money.format(summary.revenue)], ["Terkirim", summary.delivered], ["Menunggu", summary.waiting]];
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">LAPORAN HARIAN</p><h1 className="page-title">Rekap</h1><p className="page-subtitle">Ringkasan transaksi berdasarkan tanggal order dibuat.</p></div><Form method="get" className="flex items-end gap-2"><label className="field-label">Tanggal<input className="field-input" type="date" name="date" defaultValue={searchParams.get("date") || summary.date} /></label><button className="button-secondary" type="submit">Tampilkan</button></Form></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label, value]) => <section key={String(label)} className="rounded-2xl border border-[#e6ded2] bg-white p-5"><p className="text-xs uppercase tracking-[0.14em] text-[#a09587]">{label}</p><p className="mt-4 font-display text-3xl">{value}</p></section>)}</div><section className="rounded-2xl border border-[#e6ded2] bg-white p-6"><p className="text-sm leading-6 text-[#84796c]">Rekap mencakup semua transaksi pada tanggal terpilih. Nilai pendapatan memakai snapshot harga saat order dibuat.</p></section></div>;
}
