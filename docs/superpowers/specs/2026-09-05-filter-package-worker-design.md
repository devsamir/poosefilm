# Filter Package Worker Design

## Goal

Allow staff to choose a filter package during cashier order creation and automatically generate independent filtered image variants on the Hostinger VPS after an original image upload. The original image remains available, each package filter produces one separate variant, and navigation or closing the browser does not interrupt server-side processing.

## Decisions

- Filter packages are selected in the Kasir tab and have no additional price for the current release.
- Each filter is applied independently to the original image; filters are never chained.
- Videos remain original-only in the first release.
- Filter and package master data are managed from the existing superadmin-only Settings area.
- Existing order price calculation remains based on print quantity and price per print. Package pricing can be added later without changing generated-file relationships.
- The web application and a separate worker process run on the same Hostinger VPS under PM2.

## Data model

- `FilterTemplate` stores a unique name, preview color, active state, and its CSS filter values.
- `FilterTemplateValue` stores one filter function and unit-bearing value per template.
- `FilterPackage` stores a unique name, active state, and ordered package items.
- `FilterPackageItem` relates a package to one filter template with a unique package/filter pair and sort order.
- `OrderFilterSnapshot` stores the selected package's filter name, CSS string, source filter id, and order position at order creation. This prevents later master edits from changing an existing order.
- `Order.filterPackageId` is optional and records the selected package for reporting and UI context.
- `OrderFile` gains an optional `sourceFileId`, optional `filterSnapshotId`, and a variant kind. Original files have no source/filter reference; derived files point to the original and snapshot.
- `FilterRenderJob` identifies one original image, tracks `PENDING`, `PROCESSING`, `COMPLETED`, or `FAILED`, stores retry/error metadata, and is unique per original file.
- The order becomes `READY` only when every image render job for the order is complete. Orders without a package keep the current behavior and become `READY` after the original upload.

## Filter processing

The worker claims pending jobs with a short database lease so multiple workers cannot process the same job. It downloads the original object from R2, applies the snapshot CSS-equivalent operations with Sharp, uploads one derived object per snapshot, creates derived `OrderFile` rows idempotently, and marks the job complete. A failed job records the error and can be retried without duplicating completed variants.

The worker must not use CSS text as an unsafe shell or query expression. Filter types and numeric values are validated against the supported configuration before persistence and before processing. The first supported operations mirror the Poosebox set: grayscale, sepia, blur, brightness, hue-rotate, saturate, opacity, contrast, and invert. The preview CSS and Sharp output should be documented as equivalent visual intent; exact browser CSS parity is not assumed for every operation.

## User flow

1. Kasir loads active packages and displays an optional package selector.
2. Creating an order stores the package and immutable filter snapshots.
3. Upload completion stores the original file and enqueues a render job for image files when snapshots exist.
4. The global upload manager reports original upload completion; the queue/history loader displays filter processing status from the database.
5. The worker produces all variants independently and then transitions the order to `READY`.
6. Queue staff can only mark an order delivered after all render jobs have completed. Customer pages list original and derived files individually.

## Error handling

- Missing R2 originals make a job fail with a visible error and retry metadata; they do not silently mark the order ready.
- A missing R2 object during cleanup is treated as already deleted.
- R2/database writes are idempotent by source file and filter snapshot, so worker retries do not create duplicate variants.
- If one filter fails, the job remains failed and the order stays unavailable for delivery until retry succeeds or staff removes the package/output according to a later operational decision.
- Worker crashes leave leases recoverable after a timeout.

## Deployment

- Add `sharp` to the application dependencies.
- Add a worker entrypoint and a PM2 ecosystem configuration with separate web and worker processes.
- Provide the same database and R2 environment variables to both processes.
- Run Prisma migration before starting the new release; do not use an unreconciled migration history.

## Testing

- Pure tests cover supported filter validation, CSS generation, independent package expansion, snapshot creation, job state transitions, retry/idempotency rules, and order readiness rules.
- Route/source tests cover superadmin settings access, cashier package submission, upload job creation, queue delivery guards, and public file serialization.
- Worker tests use injected storage/processor boundaries and verify one original produces one variant per filter without chaining.
- Full verification includes `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check`.
