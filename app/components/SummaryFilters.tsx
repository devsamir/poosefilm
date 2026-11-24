import { Form, Link, useSearchParams } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { RiArrowDownSLine, RiCalendarLine, RiCloseLine } from "react-icons/ri";

import { formatSummaryPeriod } from "~/utils/summary-period";

type SummaryFilterOption = { id: number | string; name: string };
type SummaryFilterValues = { from: string; to: string; productId: string; filterPackageId: string };
type SummaryFilterPicker = "period" | "additional";

const panelClass = "absolute inset-x-0 top-full z-[5] mt-2 space-y-4 rounded-2xl border border-[#e6ded2] bg-white p-4 shadow-lg sm:right-auto sm:w-80";
const resetClass = "rounded-lg px-2 py-2 text-sm font-semibold text-[#62594f] hover:bg-[#f7f3ed]";

export function SummaryFilters({ filters, products, filterPackages }: {
  filters: SummaryFilterValues;
  products: SummaryFilterOption[];
  filterPackages: SummaryFilterOption[];
}) {
  const [params] = useSearchParams();
  const [openPicker, setOpenPicker] = useState<SummaryFilterPicker | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const periodTrigger = useRef<HTMLButtonElement>(null);
  const additionalTrigger = useRef<HTMLButtonElement>(null);
  const explicitPeriod = params.has("from") || params.has("to") || params.has("date");
  const chips = [
    { param: "productId", name: products.find(({ id }) => String(id) === filters.productId)?.name, label: "produk" },
    { param: "filterPackageId", name: filterPackages.find(({ id }) => String(id) === filters.filterPackageId)?.name, label: "paket filter" },
  ].filter(({ name }) => name);

  useEffect(() => {
    if (!openPicker) return;

    function dismissOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !toolbar.current?.contains(event.target)) setOpenPicker(null);
    }

    document.addEventListener("pointerdown", dismissOnOutsideClick);
    return () => document.removeEventListener("pointerdown", dismissOnOutsideClick);
  }, [openPicker]);

  function togglePicker(picker: SummaryFilterPicker) {
    setOpenPicker((currentPicker) => currentPicker === picker ? null : picker);
  }

  function closePicker() {
    (openPicker === "period" ? periodTrigger : additionalTrigger).current?.focus();
    setOpenPicker(null);
  }

  function clearFilters(...names: string[]) {
    const nextParams = new URLSearchParams(params);
    for (const name of names) nextParams.delete(name);
    const query = nextParams.toString();
    return query ? "?" + query : "/admin/summary";
  }

  return (
    <div
      ref={toolbar}
      className="relative flex flex-wrap items-end gap-x-3 gap-y-2"
      onKeyDown={(event) => {
        if (event.key === "Escape" && openPicker) closePicker();
      }}
    >
      <div className="sm:relative">
        <span className="field-label mb-2" id="summary-period-label">Periode</span>
        <button
          ref={periodTrigger}
          type="button"
          className="button-secondary min-h-11 gap-2 px-3"
          aria-labelledby="summary-period-label summary-period-value"
          aria-expanded={openPicker === "period"}
          aria-controls={openPicker === "period" ? "summary-period-picker" : undefined}
          onClick={() => togglePicker("period")}
        >
          <RiCalendarLine aria-hidden="true" className="shrink-0 text-base" />
          <span id="summary-period-value">{formatSummaryPeriod(filters)}</span>
          <RiArrowDownSLine aria-hidden="true" className="shrink-0 text-base" />
        </button>
        {openPicker === "period" ? (
          <Form
            key={filters.from + ":" + filters.to}
            id="summary-period-picker"
            method="get"
            aria-label="Ubah periode"
            className={panelClass}
            onSubmit={closePicker}
          >
            {filters.productId ? <input type="hidden" name="productId" value={filters.productId} /> : null}
            {filters.filterPackageId ? <input type="hidden" name="filterPackageId" value={filters.filterPackageId} /> : null}
            <label className="field-label">
              Dari tanggal
              <input className="field-input" type="date" name="from" defaultValue={filters.from} required />
            </label>
            <label className="field-label">
              Sampai tanggal
              <input className="field-input" type="date" name="to" defaultValue={filters.to} required />
            </label>
            <div className="flex items-center justify-between gap-4">
              <Link className={resetClass} to={clearFilters("from", "to", "date")} onClick={closePicker}>Bulan ini</Link>
              <button className="button-primary" type="submit">Tampilkan</button>
            </div>
          </Form>
        ) : null}
      </div>

      <div className="sm:relative">
        <button
          ref={additionalTrigger}
          type="button"
          className={`min-h-11 gap-2 px-3 ${openPicker === "additional" ? "button-primary" : "button-secondary"}`}
          aria-expanded={openPicker === "additional"}
          aria-controls={openPicker === "additional" ? "summary-additional-picker" : undefined}
          onClick={() => togglePicker("additional")}
        >
          Filter lainnya
          {chips.length ? <span className="rounded-full bg-[#eee7de] px-1.5 py-0.5 text-xs leading-none text-[#25231f]">{chips.length}</span> : null}
          <RiArrowDownSLine aria-hidden="true" className="shrink-0 text-base" />
        </button>
        {openPicker === "additional" ? (
          <Form
            key={filters.productId + ":" + filters.filterPackageId}
            id="summary-additional-picker"
            method="get"
            aria-label="Ubah produk dan paket filter"
            className={panelClass}
            onSubmit={closePicker}
          >
            {explicitPeriod ? (
              <>
                <input type="hidden" name="from" value={filters.from} />
                <input type="hidden" name="to" value={filters.to} />
              </>
            ) : null}
            <label className="field-label">
              Produk
              <select className="field-input" name="productId" defaultValue={filters.productId}>
                <option value="">Semua produk</option>
                {products.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="field-label">
              Paket filter
              <select className="field-input" name="filterPackageId" defaultValue={filters.filterPackageId}>
                <option value="">Semua paket</option>
                {filterPackages.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <div className="flex items-center justify-between gap-4">
              <Link className={resetClass} to={clearFilters("productId", "filterPackageId")} onClick={closePicker}>Reset</Link>
              <button className="button-primary" type="submit">Tampilkan</button>
            </div>
          </Form>
        ) : null}
      </div>

      {chips.length ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 pb-1">
          {chips.map(({ param, name, label }) => (
            <Link
              key={param}
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-[#e6ded2] bg-[#eee7de] py-1.5 pl-3 pr-2 text-xs font-semibold text-[#4a443d] hover:bg-[#e6ded2]"
              to={clearFilters(param)}
              onClick={() => setOpenPicker(null)}
              aria-label={`Hapus filter ${label} ${name}`}
            >
              <span className="truncate">{name}</span>
              <RiCloseLine aria-hidden="true" className="shrink-0 text-base" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
