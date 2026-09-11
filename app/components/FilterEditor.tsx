import { Form } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import { FILTER_CONFIGS, generateFilterCss, type FilterValueInput } from "~/utils/filter-domain";

const filterLabels: Record<string, string> = { grayscale: "Grayscale", sepia: "Sepia", blur: "Blur", brightness: "Brightness", "hue-rotate": "Hue rotate", saturate: "Saturate", opacity: "Opacity", contrast: "Contrast", invert: "Invert" };

export function FilterEditor({ intent, filter, submitLabel, sampleImage, onSampleImageChange }: { intent: "filter-create" | "filter-update"; filter?: { id: number; name: string; previewColor: string | null; values: FilterValueInput[] }; submitLabel: string; sampleImage: File | null; onSampleImageChange: (file: File | null) => void }) {
  const initialValues = Object.entries(FILTER_CONFIGS).map(([filterType, config]) => ({ filterType, value: filter?.values.find((value) => value.filterType === filterType)?.value || config.defaultValue }));
  const [values, setValues] = useState<FilterValueInput[]>(initialValues);
  const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!sampleImage) { setSampleImageUrl(null); return; }
    const url = URL.createObjectURL(sampleImage);
    setSampleImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sampleImage]);

  useEffect(() => { if (previewUrl) return () => URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    abortRef.current?.abort();
    setPreviewUrl(null);
    setPreviewError(null);
  }, [sampleImage]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handlePreview() {
    if (!sampleImage) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const body = new FormData();
      body.set("image", sampleImage);
      body.set("css", generateFilterCss(values));
      const response = await fetch("/api/filter-templates/preview", { method: "POST", body, signal: controller.signal });
      if (response.redirected) throw new Error("Sesi login habis. Muat ulang halaman lalu coba lagi.");
      if (!response.ok) throw new Error((await response.text()) || "Gagal membuat preview.");
      const blob = await response.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPreviewError(error instanceof Error ? error.message : "Gagal membuat preview.");
    } finally {
      if (abortRef.current === controller) setIsPreviewing(false);
    }
  }

  return <Form method="post" className="space-y-4 rounded-xl border border-[#eee7df] p-4"><input type="hidden" name="intent" value={intent} />{filter ? <input type="hidden" name="id" value={filter.id} /> : null}<label className="field-label">Nama filter<input className="field-input" name="name" defaultValue={filter?.name || ""} required /></label><label className="field-label">Warna preview<input className="h-10 w-16 cursor-pointer rounded border border-[#e6ded2]" type="color" name="previewColor" defaultValue={filter?.previewColor || "#FFFFFF"} /></label><input type="hidden" name="values" value={JSON.stringify(values)} /><div className="space-y-3">{values.map((value) => { const config = FILTER_CONFIGS[value.filterType as keyof typeof FILTER_CONFIGS]; return <label key={value.filterType} className="block text-xs"><span className="flex justify-between"><span>{filterLabels[value.filterType]}</span><span>{value.value}</span></span><input className="mt-1 w-full" type="range" min={config.min} max={config.max} value={Number.parseFloat(value.value)} onChange={(event) => setValues((current) => current.map((item) => item.filterType === value.filterType ? { ...item, value: `${event.target.value}${config.unit}` } : item))} /></label>; })}</div><div className="space-y-3 rounded-xl border border-[#eee7df] p-4"><p className="text-xs font-semibold text-[#1f2528]">Preview di foto sample</p><input ref={filePickerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onSampleImageChange(file); event.target.value = ""; }} />{sampleImage ? <div className="flex flex-wrap items-center gap-3">{sampleImageUrl ? <img className="h-20 w-20 rounded-lg object-cover" src={sampleImageUrl} alt="Foto sample" /> : null}<button className="button-secondary text-xs" type="button" onClick={() => filePickerRef.current?.click()}>Ganti foto</button><button className="button-secondary text-xs" type="button" onClick={handlePreview} disabled={isPreviewing}>{isPreviewing ? "Memproses..." : "Preview"}</button></div> : <button className="button-secondary text-xs" type="button" onClick={() => filePickerRef.current?.click()}>Pilih foto sample</button>}{previewError ? <p className="text-xs text-red-700">{previewError}</p> : null}{previewUrl ? <img className="w-full max-w-xs rounded-lg border border-[#eee7df]" src={previewUrl} alt="Hasil filter pada foto sample" /> : null}</div><button className="button-secondary text-xs" type="submit">{submitLabel}</button></Form>;
}
