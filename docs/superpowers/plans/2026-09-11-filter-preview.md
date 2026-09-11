# Filter Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff upload a sample photo in the filter-template editor and render it through the real Sharp pipeline, so they can see exactly what a filter will look like on an actual photo before saving it.

**Architecture:** A new stateless resource route accepts a sample image + a CSS filter string as multipart form data, runs the existing pure `renderFilteredImage` function against it, and streams back the resulting JPEG — nothing is persisted. The sample image itself lives in plain React state on the Settings page (not the filter editor, so it survives switching between filters) and is sent to the new route via a direct `fetch()` call, not Remix's data-router `Form`/`useFetcher`, since the response is a binary image rather than JSON.

**Tech Stack:** Remix (`@remix-run/node`), Sharp (already a dependency), React, TypeScript, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-09-11-filter-preview-design.md`

---

## Task 1: Preview route

**Files:**
- Create: `app/routes/api.filter-templates.preview.ts`

- [ ] **Step 1: Write the route**

```ts
import { type ActionFunctionArgs } from "@remix-run/node";

import { requireSuperadmin } from "~/services/auth.server";
import { renderFilteredImage } from "~/services/filter-processor.server";

const PREVIEW_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PREVIEW_IMAGE_LIMIT = 10 * 1024 * 1024;

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperadmin(request);
  const formData = await request.formData();
  const image = formData.get("image");
  const css = String(formData.get("css") || "");

  if (!(image instanceof File) || !PREVIEW_IMAGE_TYPES.has(image.type) || image.size < 1 || image.size > PREVIEW_IMAGE_LIMIT) {
    return new Response("Foto sample tidak valid. Gunakan JPG, PNG, atau WebP maksimal 10 MB.", { status: 400 });
  }

  try {
    const sourceBuffer = Buffer.from(await image.arrayBuffer());
    const rendered = await renderFilteredImage({ sourceBuffer, filterCss: css });
    return new Response(rendered, { headers: { "Content-Type": "image/jpeg" } });
  } catch (error) {
    console.warn("Gagal membuat preview filter", error);
    return new Response("Gagal memproses foto sample.", { status: 400 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. `File` is a global type available via this project's `DOM` lib (see `tsconfig.json`) — no import needed. `Buffer` is a Node global, also no import needed.

- [ ] **Step 3: Commit**

```bash
git add app/routes/api.filter-templates.preview.ts
git commit -m "$(cat <<'EOF'
feat: add stateless filter-preview render route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Context

`renderFilteredImage({ sourceBuffer: Buffer, filterCss: string }): Promise<Buffer>` already exists in `app/services/filter-processor.server.ts:109` — it's a pure function with no R2/Prisma/queue dependency, used today by the order-processing pipeline. This route is the first caller to invoke it directly against an ad-hoc upload instead of an order file, and the first route in this codebase to read a file upload via the native `request.formData()` (Node's built-in Fetch API `FormData`/`File` support — no `unstable_parseMultipartFormData` needed since these are small, in-memory files). Nothing this route does is persisted to R2, the database, or disk — the uploaded bytes exist only for the duration of this one request/response.

This route has no dedicated automated test (per the design spec's Testing section) — this codebase has no route-mocking or Sharp-mocking infrastructure, and the underlying `renderFilteredImage` function itself has no direct unit test today either (it's exercised indirectly via the order render pipeline). Verification is manual, in Task 4.

## Before You Begin

If you have questions about the requirements, approach, or anything unclear above, ask them now before starting work.

## Your Job

1. Create the route file exactly as shown.
2. Typecheck.
3. Commit.
4. Self-review (see below).
5. Report back.

## When You're in Over Your Head

It's OK to stop and say "this is too hard for me." Report BLOCKED or NEEDS_CONTEXT rather than guessing.

## Before Reporting Back: Self-Review

Check: does the route match exactly (same validation order, same error messages, same status codes)? Does it import `renderFilteredImage` from the right path? Did you avoid adding anything not specified (no extra logging beyond the one `console.warn`, no extra validation)?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- Typecheck output
- Files changed
- Self-review findings (if any)
- Git commit SHA

---

## Task 2: Lift sample-image state to the Settings page

**Files:**
- Modify: `app/routes/admin.settings.tsx`

- [ ] **Step 1: Add state and pass it down**

In `app/routes/admin.settings.tsx`, add a new `useState` right after the existing `const [modal, setModal] = useState<SettingsModalState | null>(null);` (line 70):

```tsx
  const [modal, setModal] = useState<SettingsModalState | null>(null);
  const [sampleImage, setSampleImage] = useState<File | null>(null);
```

Then update the `FilterEditor` usage (currently on line 106):

```tsx
{modal?.type === "filter" ? <SettingsModal open title={selectedFilter ? `Edit ${selectedFilter.name}` : "Buat filter baru"} description="Atur karakter warna foto. Nilai filter disimpan sebagai resep, lalu diproses server saat dipakai order." onClose={() => setModal(null)}><FilterEditor key={selectedFilter?.id || "new-filter"} intent={selectedFilter ? "filter-update" : "filter-create"} filter={selectedFilter} submitLabel={selectedFilter ? "Simpan perubahan" : "Simpan filter"} /></SettingsModal> : null}
```

to:

```tsx
{modal?.type === "filter" ? <SettingsModal open title={selectedFilter ? `Edit ${selectedFilter.name}` : "Buat filter baru"} description="Atur karakter warna foto. Nilai filter disimpan sebagai resep, lalu diproses server saat dipakai order." onClose={() => setModal(null)}><FilterEditor key={selectedFilter?.id || "new-filter"} intent={selectedFilter ? "filter-update" : "filter-create"} filter={selectedFilter} submitLabel={selectedFilter ? "Simpan perubahan" : "Simpan filter"} sampleImage={sampleImage} onSampleImageChange={setSampleImage} /></SettingsModal> : null}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: this will FAIL at this point, because `FilterEditor` doesn't accept `sampleImage`/`onSampleImageChange` props yet — that's Task 3. This is expected; do not treat it as a blocker for finishing this task's commit. (If you'd rather avoid a red typecheck between commits, you may do Task 2 and Task 3 as one combined edit before your first commit in this task — either order is fine, but the two files must end up consistent before you move on to Task 4.)

- [ ] **Step 3: Commit**

Only commit once `npm run typecheck` is clean — i.e. after Task 3's `FilterEditor` change is also in place. If you implemented Task 2 and Task 3 together, commit both files now:

```bash
git add app/routes/admin.settings.tsx app/components/FilterEditor.tsx
git commit -m "$(cat <<'EOF'
feat: add sample-photo preview to the filter editor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(If you're doing Task 2 and Task 3 as strictly separate commits instead, that's fine too — just make sure Task 2's commit isn't the one left with a broken typecheck; sequence the two tasks so every commit you make leaves `npm run typecheck` clean.)

## Context

This state is deliberately lifted to `SettingsPage` (not kept inside `FilterEditor`) so the sample photo survives closing one filter's editor and opening another's — per the design spec, staff upload one sample photo per Settings visit and reuse it across every filter they preview. `FilterEditor` already gets fully remounted (via its `key={selectedFilter?.id || "new-filter"}`) whenever the admin switches which filter they're editing, which would reset any state kept inside it — lifting `sampleImage` to the parent avoids that.

## Before You Begin

Ask now if anything is unclear.

## Your Job

Implement Task 2 and Task 3 together (see Task 3 below) so you never leave the tree in a state where `npm run typecheck` fails at a commit boundary. Self-review both, then report back once, covering both files.

---

## Task 3: `FilterEditor` upload + preview UI

**Files:**
- Modify: `app/components/FilterEditor.tsx`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `app/components/FilterEditor.tsx` with:

```tsx
import { Form } from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FILTER_CONFIGS, generateFilterCss, type FilterValueInput } from "~/utils/filter-domain";

const filterLabels: Record<string, string> = { grayscale: "Grayscale", sepia: "Sepia", blur: "Blur", brightness: "Brightness", "hue-rotate": "Hue rotate", saturate: "Saturate", opacity: "Opacity", contrast: "Contrast", invert: "Invert" };

export function FilterEditor({ intent, filter, submitLabel, sampleImage, onSampleImageChange }: { intent: "filter-create" | "filter-update"; filter?: { id: number; name: string; previewColor: string | null; values: FilterValueInput[] }; submitLabel: string; sampleImage: File | null; onSampleImageChange: (file: File | null) => void }) {
  const initialValues = Object.entries(FILTER_CONFIGS).map(([filterType, config]) => ({ filterType, value: filter?.values.find((value) => value.filterType === filterType)?.value || config.defaultValue }));
  const [values, setValues] = useState<FilterValueInput[]>(initialValues);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const filePickerRef = useRef<HTMLInputElement>(null);

  const sampleImageUrl = useMemo(() => (sampleImage ? URL.createObjectURL(sampleImage) : null), [sampleImage]);

  useEffect(() => () => { if (sampleImageUrl) URL.revokeObjectURL(sampleImageUrl); }, [sampleImageUrl]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { setPreviewUrl(null); setPreviewError(null); }, [sampleImage]);

  async function handlePreview() {
    if (!sampleImage) return;
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const body = new FormData();
      body.set("image", sampleImage);
      body.set("css", generateFilterCss(values));
      const response = await fetch("/api/filter-templates/preview", { method: "POST", body });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Gagal membuat preview.");
    } finally {
      setIsPreviewing(false);
    }
  }

  return <Form method="post" className="space-y-4 rounded-xl border border-[#eee7df] p-4"><input type="hidden" name="intent" value={intent} />{filter ? <input type="hidden" name="id" value={filter.id} /> : null}<label className="field-label">Nama filter<input className="field-input" name="name" defaultValue={filter?.name || ""} required /></label><label className="field-label">Warna preview<input className="h-10 w-16 cursor-pointer rounded border border-[#e6ded2]" type="color" name="previewColor" defaultValue={filter?.previewColor || "#FFFFFF"} /></label><input type="hidden" name="values" value={JSON.stringify(values)} /><div className="space-y-3">{values.map((value) => { const config = FILTER_CONFIGS[value.filterType as keyof typeof FILTER_CONFIGS]; return <label key={value.filterType} className="block text-xs"><span className="flex justify-between"><span>{filterLabels[value.filterType]}</span><span>{value.value}</span></span><input className="mt-1 w-full" type="range" min={config.min} max={config.max} value={Number.parseFloat(value.value)} onChange={(event) => setValues((current) => current.map((item) => item.filterType === value.filterType ? { ...item, value: `${event.target.value}${config.unit}` } : item))} /></label>; })}</div><div className="space-y-3 rounded-xl border border-[#eee7df] p-4"><p className="text-xs font-semibold text-[#1f2528]">Preview di foto sample</p><input ref={filePickerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onSampleImageChange(file); event.target.value = ""; }} />{sampleImage ? <div className="flex flex-wrap items-center gap-3">{sampleImageUrl ? <img className="h-20 w-20 rounded-lg object-cover" src={sampleImageUrl} alt="Foto sample" /> : null}<button className="button-secondary text-xs" type="button" onClick={() => filePickerRef.current?.click()}>Ganti foto</button><button className="button-secondary text-xs" type="button" onClick={handlePreview} disabled={isPreviewing}>{isPreviewing ? "Memproses..." : "Preview"}</button></div> : <button className="button-secondary text-xs" type="button" onClick={() => filePickerRef.current?.click()}>Pilih foto sample</button>}{previewError ? <p className="text-xs text-red-700">{previewError}</p> : null}{previewUrl ? <img className="w-full max-w-xs rounded-lg border border-[#eee7df]" src={previewUrl} alt="Hasil filter pada foto sample" /> : null}</div><button className="button-secondary text-xs" type="submit">{submitLabel}</button></Form>;
}
```

- [ ] **Step 2: Typecheck, lint, and run the full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean, no regressions. There's no new automated test for this component (matches the spec's explicit testing scope) — confirmed via `grep -rl "FilterEditor" tests/` that no existing test file references `FilterEditor` at all, so its prop-shape change can't break an existing test. The full suite must still pass to confirm nothing else broke.

- [ ] **Step 3: Commit**

See Task 2 Step 3 — commit both `app/routes/admin.settings.tsx` and `app/components/FilterEditor.tsx` together once typecheck/lint/tests are all clean.

## Context

Key behaviors this component now has, all driven by the two new props (`sampleImage: File | null`, `onSampleImageChange: (file: File | null) => void`) owned by the parent `SettingsPage`:

- No sample image yet → a single "Pilih foto sample" button opens the hidden file input.
- A sample image is set → shows a small thumbnail (`sampleImageUrl`, a `useMemo`-derived object URL, revoked on change/unmount to avoid leaking blob URLs), a "Ganti foto" button (re-opens the same file input), and a "Preview" button.
- Clicking "Preview" (`handlePreview`) builds `multipart/form-data` with the raw `File` and `generateFilterCss(values)` (the exact same pure CSS-string builder already used elsewhere in this codebase, imported from `~/utils/filter-domain`), POSTs it directly via `fetch()` (not Remix's `useFetcher`, since the route's response is a binary JPEG, not JSON, and a plain `fetch()` + `response.blob()` is the simplest way to handle that) to the route from Task 1, and displays the result as another object URL.
- Switching the sample image (`useEffect` keyed on `sampleImage`) clears any stale rendered preview/error from the previous photo, since a leftover preview of the OLD photo next to a NEW thumbnail would be confusing.
- The existing `<Form method="post">` that actually saves the filter template (`intent`/`name`/`previewColor`/`values` hidden inputs, the sliders, the submit button) is completely unchanged — the new preview UI is purely additive, inserted as one new block between the sliders and the submit button, and never touches form submission.

## Before You Begin

Ask now if anything is unclear — especially if the actual current `FilterEditor.tsx` or `admin.settings.tsx` content differs from what's shown (read both files first).

## Your Job

1. Implement Task 2 and Task 3 together.
2. Typecheck, lint, run the full suite.
3. Commit.
4. Self-review (see below).
5. Report back.

## When You're in Over Your Head

It's OK to stop and say "this is too hard for me." Report BLOCKED or NEEDS_CONTEXT rather than guessing.

## Before Reporting Back: Self-Review

Check: does clicking "Ganti foto" or "Pilih foto sample" open the file picker (via the `ref`)? Does selecting a file call `onSampleImageChange` with it? Are both object URLs (`sampleImageUrl` and `previewUrl`) correctly revoked (check the two cleanup effects) so repeated previews don't leak memory? Does switching filters (which remounts `FilterEditor` via its `key`) correctly preserve `sampleImage` (owned by the parent) while resetting `previewUrl`/`previewError` (owned by this component, naturally reset by the remount)? Is the existing save-form behavior (the actual `<Form method="post">`) completely untouched?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- Test results (full suite summary)
- Typecheck/lint output
- Files changed
- Self-review findings (if any)
- Git commit SHA

---

## Task 4: Manual verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 2: Start the dev server and exercise the feature in a browser**

Run: `npm run dev:web` (or the project's existing dev server launch config)

In the browser:
1. Log in as superadmin, go to `/admin/settings`.
2. Open "Buat filter baru" (or edit an existing filter). Confirm a "Pilih foto sample" button appears below the sliders.
3. Pick a sample JPG/PNG. Confirm a thumbnail appears, plus "Ganti foto" and "Preview" buttons.
4. Adjust a slider (e.g. grayscale to 100%). Click "Preview". Confirm a loading state shows briefly, then a rendered image appears below, visibly grayscale.
5. Adjust another slider (e.g. sepia) and click "Preview" again. Confirm the new rendered result reflects the updated combination, and the previous rendered image is replaced (not stacked).
6. Close this filter's editor (without saving) and open a DIFFERENT filter's editor. Confirm the same sample photo/thumbnail is still there (no need to re-upload) but there's no leftover rendered preview from the other filter.
7. Click "Ganti foto" and pick a different sample image. Confirm the thumbnail updates and any previous rendered preview is cleared.
8. Try an invalid case: if convenient, use browser dev tools to simulate a >10MB file or check that a non-image file is rejected by the file picker's `accept` filter — otherwise, confirm at minimum that a normal JPG/PNG/WebP under 10MB works end to end.
9. Confirm the actual "Simpan filter"/"Simpan perubahan" save button still works normally and is unaffected by any of the preview interactions.

- [ ] **Step 3: Stop the dev server**

No commit for this task — it's verification only.
