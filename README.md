# Poosefilm POS

Standalone Remix POS for Poosefilm photo orders.

## Local setup

1. Create a local PostgreSQL database named `poosefilm` owned by `devsam`.
2. Copy `.env.example` to `.env`, set the local database and Cloudflare R2 values, and set `INITIAL_ADMIN_PASSWORD` for the first seed.
3. Install dependencies with `npm install`.
4. Apply the checked-in Prisma migrations and seed with `npx prisma migrate deploy` and `npx prisma db seed`.
5. Start development with `npm run dev`; this starts both the Remix web process and the filter worker.

Before the first browser upload, configure the bucket CORS rules with
`npm run r2:cors`. Add any additional frontend origin to `R2_CORS_ORIGINS`.

Webcam recordings are converted server-side to MP4 with audio. Install FFmpeg
on the host and set `FFMPEG_PATH` when the executable is not available as
`ffmpeg` on the process PATH.

The initial SUPERADMIN is `admin@poosefilm.id`. The seed reads the initial
password from `INITIAL_ADMIN_PASSWORD`; change it after first access. Rerunning
the seed preserves the existing password.

## MVP workflow

- `Kasir`: pick products and quantities, create a paid cash order, and print its QR receipt.
- `Settings` (SUPERADMIN only): manage products (name, price), WhatsApp template, filter masters, and filter packages.
- `Antrian`: upload image/video files directly to Cloudflare R2, open a prefilled WhatsApp message, and mark an order complete.
- `Riwayat`: search delivered orders, open a prefilled WhatsApp message, and print individual receipts.
- `Rekap`: review daily order, revenue, delivered, and waiting totals.
- `/order/:code`: public customer page with individual image/video previews and downloads.

WhatsApp API sending, Google Drive, QRIS, and payment gateway integration are intentionally deferred. WhatsApp currently opens a prefilled `wa.me` message for staff to send manually.

When a filter package is selected at the cashier, each uploaded image is kept as
an original and rendered independently into one JPEG per filter by the server
worker. Videos stay original-only for now. The worker keeps processing after a
staff member changes tabs or closes the browser.

## Production

Build with `npm run build` and run both processes with PM2 using
`pm2 start ecosystem.config.cjs` behind the `pos.poosebox.id` reverse proxy.
Production must provide its own database, session, and Cloudflare R2
environment variables. Set
`PUBLIC_ORDER_BASE_URL=https://pos.poosebox.id` so printed QR codes resolve to
the deployed public portal. The web and worker processes must receive the same
environment variables, and the checked-in Prisma migrations must be applied
before starting the release.
