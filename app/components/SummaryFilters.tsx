import { Form, Link, useLocation } from "@remix-run/react";

type SummaryFilterOption = { id: number | string; name: string };
type SummaryFilterValues = { from: string; to: string; productId: string; filterPackageId: string };

export function SummaryFilters({ filters, products, filterPackages }: {
  filters: SummaryFilterValues;
  products: SummaryFilterOption[];
  filterPackages: SummaryFilterOption[];
}) {
  const { key } = useLocation();

  return (
    <Form
      key={key}
      method="get"
      aria-label="Filter rekap"
      className="grid items-end gap-3 rounded-2xl border border-[#e6ded2] bg-white p-4 lg:landscape:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
    >
      <label className="field-label min-w-0">
        Dari tanggal
        <input className="field-input h-12 min-w-0" type="date" name="from" defaultValue={filters.from} required />
      </label>
      <label className="field-label min-w-0">
        Sampai tanggal
        <input className="field-input h-12 min-w-0" type="date" name="to" defaultValue={filters.to} required />
      </label>
      <label className="field-label min-w-0">
        Produk
        <select className="field-input h-12" name="productId" defaultValue={filters.productId}>
          <option value="">Semua produk</option>
          {products.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="field-label min-w-0">
        Paket filter
        <select className="field-input h-12" name="filterPackageId" defaultValue={filters.filterPackageId}>
          <option value="">Semua paket</option>
          {filterPackages.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <div className="flex items-center justify-end gap-2">
        <Link className="inline-flex h-12 items-center rounded-xl px-3 text-sm font-semibold text-[#62594f] hover:bg-[#f7f3ed]" to="/admin/summary">Reset</Link>
        <button className="button-primary h-12" type="submit">Tampilkan</button>
      </div>
    </Form>
  );
}
