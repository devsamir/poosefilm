# History ZIP Export Design

## Goal

Let staff download all photo/video attachments from delivered orders within a chosen date range as a single ZIP file, from the existing Riwayat (history) admin page.

## Decisions

- Archive format is ZIP, not RAR. RAR authoring requires a proprietary binary (WinRAR/`rar`) that Node cannot produce natively; ZIP is natively supported (`archiver` package) and opens on every OS without extra software.
- Scope is delivered orders only (`status: DELIVERED`), matching what the Riwayat page already shows. Orders still in progress are excluded.
- Date range filters on `Order.createdAt`, consistent with the existing history sort order (`createdAt desc`).
- Export is a single synchronous streaming download (no background job/queue). Files are streamed one at a time from R2 straight into the ZIP response, so memory use stays roughly constant regardless of how many/large the videos are. A job-queue based approach (similar to `filter-render-worker`) is deferred until real usage shows the synchronous approach is insufficient.
- Any authenticated user who can view Riwayat can trigger the export (no extra superadmin gate beyond current `requireUser`).

## Data flow

1. Staff picks `from`/`to` dates (and optionally reuses the current search query) on the Riwayat page and clicks "Download ZIP", a plain link to the export route.
2. `app/routes/api.history.export-zip.ts` loader:
   - Validates `from`/`to` (parseable dates, `from <= to`); 400 with a Bahasa Indonesia message otherwise.
   - Calls a new `listDeliveredOrdersInRange(from, to, query)` in `reports.server.ts` (Prisma: `status: DELIVERED`, `createdAt: { gte: from, lt: to+1day }`, includes `files`, ordered `createdAt asc`).
   - 400 if the range matches zero orders.
   - Builds an `archiver('zip')` stream. For each order, for each file, appends a stream from a new `getObjectStream(key)` in `r2.server.ts` (returns the S3 `GetObjectCommand` response body directly, no buffering) under an entry name `"<code>_<customerName>/<originalName>"`.
   - Calls `archive.finalize()`, converts the archiver Node stream to a web stream via `Readable.toWeb()`, and returns it as the `Response` body with `Content-Type: application/zip` and `Content-Disposition: attachment; filename="riwayat_<from>_<to>.zip"`.

## UI changes

- `app/routes/admin.history.tsx`: add two `<input type="date">` fields (`from`, `to`) next to the existing search form, plus a "Download ZIP" link/button pointing at `/api/history/export-zip?from=...&to=...&q=...`.
- The button is disabled until both dates are filled. No custom loading state is needed; the browser handles the download natively.

## Error handling

- Invalid or reversed date range: 400, "Rentang tanggal tidak valid."
- No delivered orders in range: 400, "Tidak ada riwayat pada rentang tanggal ini."
- A single file failing to stream from R2 (deleted/corrupt object) is skipped with a server-side warning log (`order.code`, `file.originalName`); it does not fail the whole export.

## Dependencies

- Add `archiver` (+ `@types/archiver`) to `package.json`.

## Testing

- `reports.server.ts`: unit test `listDeliveredOrdersInRange` for correct date filtering and DELIVERED-only scope, following the existing pattern in `tests/orders.test.ts`.
- Route smoke test: mocked R2 stream, assert `Content-Type: application/zip` and correct `Content-Disposition` header; assert 400 on invalid range and on empty range.
