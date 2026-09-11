# Filter Preview Design

## Goal

Let staff upload a sample photo while creating/editing a filter template in Settings, and render it through the real server-side filter pipeline, so they can see exactly what the filter will look like on an actual customer photo before saving it.

## Decisions

- Preview uses the real Sharp pipeline (`renderFilteredImage`), not a CSS `filter:` approximation, because the CSS string is only a recipe — the actual customer-facing JPEG is always produced by Sharp, and the two are not guaranteed to look identical (documented in `docs/superpowers/specs/2026-09-05-filter-package-worker-design.md`).
- Preview is manually triggered by a "Preview" button, not auto-rendered while dragging sliders, to avoid hammering the server with a Sharp render on every slider tick.
- The sample photo is uploaded once per Settings page visit (plain browser-side state, not persisted anywhere) and reused across every filter template the staff member previews in that session; a "Ganti foto" control lets them swap it. Losing it on page reload is acceptable — it's disposable scratch input, not data.
- The sample photo is never written to R2, the database, or any other storage. It's sent as multipart form data straight into an in-memory `renderFilteredImage` call and the resulting JPEG bytes are returned directly; nothing about the upload persists after the response.

## Data flow

1. In `FilterEditor` (`app/components/FilterEditor.tsx`), staff pick a sample image file (or already have one loaded from `admin.settings.tsx`'s page-level state, passed down as a prop).
2. Staff adjust the existing filter sliders as today (`values` state, unchanged).
3. Staff click "Preview". A `useFetcher` submits `multipart/form-data` (`image`: the File, `css`: `generateFilterCss(values)`, the same pure CSS-string builder the app already has) to a new resource route.
4. `app/routes/api.filter-templates.preview.ts` (`action` only, `requireSuperadmin`, matching the rest of the Settings page's auth) validates the upload (content-type in `image/jpeg`, `image/png`, `image/webp`; size under 10MB — a smaller cap than the 25MB customer-upload limit since this is a quick, repeatable admin tool, not a deliverable), converts it to a `Buffer`, and calls `renderFilteredImage({ sourceBuffer, filterCss: css })`.
5. The route returns the resulting JPEG directly as the response body (`Content-Type: image/jpeg`), no JSON wrapper.
6. `FilterEditor` reads the response as a `Blob`, creates an object URL, and displays it in an `<img>` preview area. The previous object URL is revoked before creating a new one to avoid leaking memory across repeated previews.

## UI changes

- `app/routes/admin.settings.tsx`: add `const [sampleImage, setSampleImage] = useState<File | null>(null)` at the page level (survives closing/reopening the filter modal, resets on page reload). Pass `sampleImage` and `setSampleImage` down to `FilterEditor`.
- `app/components/FilterEditor.tsx`: add a preview section after the existing sliders and before the submit button:
  - If no sample image is loaded: a file input ("Pilih foto sample").
  - If one is loaded: a thumbnail of the original, a "Ganti foto" button (re-opens the file picker), a "Preview" button, and (once rendered) the resulting filtered image next to or below the original for comparison.
  - Loading state on the "Preview" button while the fetcher is submitting (Sharp processing takes a moment).
  - Inline error message if the preview request fails (e.g. corrupt/unreadable image), without blocking the rest of the form.

## Error handling

- Wrong file type or over the 10MB cap: rejected client-side before submitting (same pattern as existing upload validation), and re-validated server-side, returning 400 with a Bahasa Indonesia message if a request slips through.
- `renderFilteredImage` throwing (e.g. Sharp can't parse the file): route returns 400 with a generic "Gagal memproses foto sample." message; `FilterEditor` shows it inline, sample image stays selected so staff can retry or swap it without re-uploading.
- This route is a pure preview utility with no persistence, so there's nothing to clean up on failure.

## Testing

- No dedicated automated test for the new route or the fetcher-driven preview UI — this codebase has no mocking infrastructure for routes/Sharp, and `renderFilteredImage` itself already has no direct unit test today (it's exercised indirectly via the render-job pipeline). Verification is manual: upload a sample photo, adjust sliders, click Preview, confirm the rendered image visibly reflects the filter and matches what the same CSS produces through the existing order render pipeline.
- If a pure-function extraction naturally falls out of implementing the route (e.g. a shared "validate an uploaded image file" helper), it gets the same unit-test treatment as this codebase's other pure helpers — but no new test infrastructure is introduced for this feature.
