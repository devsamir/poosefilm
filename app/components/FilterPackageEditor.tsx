import { Form } from "@remix-run/react";
import { useState } from "react";

type FilterOption = { id: number; name: string };

export function FilterPackageEditor({ filters, intent, packageData, submitLabel }: { filters: FilterOption[]; intent: "package-create" | "package-update"; packageData?: { id: number; name: string; isActive: boolean; isDefault: boolean; filters: FilterOption[] }; submitLabel: string }) {
  const [selectedIds, setSelectedIds] = useState<number[]>(packageData?.filters.map((filter) => filter.id) || []);
  return <Form method="post" className="space-y-4 rounded-xl border border-[#eee7df] p-4"><input type="hidden" name="intent" value={intent} />{packageData ? <input type="hidden" name="id" value={packageData.id} /> : null}<label className="field-label">Nama paket<input className="field-input" name="name" defaultValue={packageData?.name || ""} required /></label><input type="hidden" name="filterTemplateIds" value={JSON.stringify(selectedIds)} /><div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a09587]">Filter dalam paket</p>{filters.map((filter) => <label key={filter.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedIds.includes(filter.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, filter.id] : current.filter((id) => id !== filter.id))} />{filter.name}</label>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" defaultChecked={packageData?.isDefault || false} />Jadikan default di kasir</label><button className="button-secondary text-xs" type="submit">{submitLabel}</button></Form>;
}
