# Poosefilm POS

Standalone Remix POS for Poosefilm photo orders.

## Local setup

1. Create a local PostgreSQL database named `poosefilm` owned by `devsam`.
2. Copy `.env.example` to `.env`, set the local database and Cloudflare R2 values, and set `INITIAL_ADMIN_PASSWORD` for the first seed.
3. Install dependencies with `npm install`.
4. Apply the Prisma schema and seed with `npx prisma migrate dev --name init_poosefilm` and `npx prisma db seed`.
5. Start development with `npm run dev`.

Before the first browser upload, configure the bucket CORS rules with
`npm run r2:cors`. Add any additional frontend origin to `R2_CORS_ORIGINS`.

The initial SUPERADMIN is `admin@poosefilm.id`. The seed reads the initial
password from `INITIAL_ADMIN_PASSWORD`; change it after first access. Rerunning
the seed preserves the existing password.

## MVP workflow

- `Kasir`: create a paid cash order and print its QR receipt.
- `Antrian`: upload image/video files directly to Cloudflare R2 and mark an order complete.
- `Riwayat`: search delivered orders and print individual receipts.
- `Rekap`: review daily order, revenue, delivered, and waiting totals.
- `/order/:code`: public customer page with individual image/video previews and downloads.

WhatsApp sending, Google Drive, QRIS, and payment gateway integration are intentionally deferred.

## Production

Build with `npm run build` and run with `npm start` behind the
`pos.poosebox.id` reverse proxy. Production must provide its own database,
session, and Cloudflare R2 environment variables. Set
`PUBLIC_ORDER_BASE_URL=https://pos.poosebox.id` so printed QR codes resolve to
the deployed public portal.
