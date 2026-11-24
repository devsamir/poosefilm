import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { SummaryFilters } from "~/components/SummaryFilters";
import { requireUser } from "~/services/auth.server";
import { getOrderSummary, listSummaryFilterOptions } from "~/services/reports.server";
import { getSummaryDateRange, readSummaryPeriod } from "~/utils/summary-period";

const ORIGINAL_ONLY = "original";
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const params = new URL(request.url).searchParams;
  const period = readSummaryPeriod(params);
  const range = getSummaryDateRange(period);
  const productId = params.get("productId") || "";
  const filterPackageId = params.get("filterPackageId") || "";
  const { products, filterPackages } = await listSummaryFilterOptions();
  const product = products.find(({ id }) => String(id) === productId);
  const filterPackage = filterPackages.find(({ id }) => String(id) === filterPackageId);
  const originalOnly = filterPackageId === ORIGINAL_ONLY;

  let error = null;
  if (!range) error = "Rentang tanggal tidak valid. Pilih tanggal mulai dan tanggal akhir yang sesuai.";
  else if (productId && !product) error = "Produk tidak ditemukan. Pilih produk dari daftar.";
  else if (filterPackageId && !filterPackage && !originalOnly) error = "Paket filter tidak ditemukan. Pilih paket dari daftar.";

  const summary = range && !error
    ? await getOrderSummary({ range, productId: product?.id, filterPackageId: originalOnly ? null : filterPackage?.id })
    : null;

  return json({
    summary,
    error,
    filters: { ...period, productId, filterPackageId },
    products,
    filterPackages: [{ id: ORIGINAL_ONLY, name: "Original saja" }, ...filterPackages],
  }, { status: error ? 400 : 200 });
}

export default function SummaryPage() {
  const { summary, error, filters, products, filterPackages } = useLoaderData<typeof loader>();
  const cards = summary ? [
    { label: "Total order", value: summary.totalOrders },
    { label: "Order real", value: summary.realOrders },
    { label: "Order FREE", value: summary.freeOrders },
    { label: "Total cetak real", value: summary.totalPrints },
    { label: "Pendapatan real", value: money.format(summary.revenue) },
    { label: "Terkirim", value: summary.delivered },
    { label: "Menunggu", value: summary.waiting },
  ] : [];

  return (
    <div className="space-y-4 lg:landscape:space-y-6">
      <div>
        <p className="eyebrow">LAPORAN TRANSAKSI</p>
        <h1 className="page-title">Rekap</h1>
        <p className="page-subtitle">Ringkasan transaksi berdasarkan tanggal order dibuat.</p>
      </div>

      <SummaryFilters filters={filters} products={products} filterPackages={filterPackages} />

      {error ? (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-2 lg:landscape:grid-cols-12 lg:landscape:gap-4">
            {cards.map(({ label, value }, index) => (
              <div
                key={label}
                className={`rounded-2xl border border-[#e6ded2] bg-white px-4 py-3 lg:landscape:p-5 ${index < 4 ? "lg:landscape:col-span-3" : "lg:landscape:col-span-4"}`}
              >
                <dt className="text-[11px] uppercase tracking-wide text-[#84796c] sm:text-xs sm:tracking-[0.14em]">{label}</dt>
                <dd className="mt-1 break-words font-display text-2xl lg:landscape:mt-4 lg:landscape:text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="rounded-2xl border border-[#e6ded2] bg-white p-5 text-sm leading-6 text-[#84796c] sm:p-6">
            Order FREE tetap masuk operasional, tetapi total dan pendapatannya tidak dihitung sebagai transaksi real.
          </p>
        </>
      )}
    </div>
  );
}
