import { Form } from "@remix-run/react";
import { useState } from "react";

import { FILTER_CONFIGS, type FilterValueInput } from "~/utils/filter-domain";

const filterLabels: Record<string, string> = { grayscale: "Grayscale", sepia: "Sepia", blur: "Blur", brightness: "Brightness", "hue-rotate": "Hue rotate", saturate: "Saturate", opacity: "Opacity", contrast: "Contrast", invert: "Invert" };

export function FilterEditor({ intent, filter, submitLabel }: { intent: "filter-create" | "filter-update"; filter?: { id: number; name: string; previewColor: string | null; values: FilterValueInput[] }; submitLabel: string }) {
  const initialValues = Object.entries(FILTER_CONFIGS).map(([filterType, config]) => ({ filterType, value: filter?.values.find((value) => value.filterType === filterType)?.value || config.defaultValue }));
  const [values, setValues] = useState<FilterValueInput[]>(initialValues);
  return <Form method="post" className="space-y-4 rounded-xl border border-[#eee7df] p-4"><input type="hidden" name="intent" value={intent} />{filter ? <input type="hidden" name="id" value={filter.id} /> : null}<label className="field-label">Nama filter<input className="field-input" name="name" defaultValue={filter?.name || ""} required /></label><label className="field-label">Warna preview<input className="h-10 w-16 cursor-pointer rounded border border-[#e6ded2]" type="color" name="previewColor" defaultValue={filter?.previewColor || "#FFFFFF"} /></label><input type="hidden" name="values" value={JSON.stringify(values)} /><div className="space-y-3">{values.map((value) => { const config = FILTER_CONFIGS[value.filterType as keyof typeof FILTER_CONFIGS]; return <label key={value.filterType} className="block text-xs"><span className="flex justify-between"><span>{filterLabels[value.filterType]}</span><span>{value.value}</span></span><input className="mt-1 w-full" type="range" min={config.min} max={config.max} value={Number.parseFloat(value.value)} onChange={(event) => setValues((current) => current.map((item) => item.filterType === value.filterType ? { ...item, value: `${event.target.value}${config.unit}` } : item))} /></label>; })}</div><button className="button-secondary text-xs" type="submit">{submitLabel}</button></Form>;
}
