-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: the global price becomes the first product, each old order gets one item
INSERT INTO "products" ("name", "price", "updated_at")
SELECT 'Cetak', COALESCE((SELECT "price_per_print" FROM "app_settings" WHERE "id" = 1), 95000), CURRENT_TIMESTAMP;

INSERT INTO "order_items" ("order_id", "product_id", "product_name", "unit_price", "quantity")
SELECT o."id", p."id", p."name", o."unit_price", o."quantity"
FROM "orders" o CROSS JOIN "products" p
WHERE p."name" = 'Cetak';

-- AlterTable: legacy pricing columns become optional; they are dropped in a later migration
ALTER TABLE "orders" ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "unit_price" DROP NOT NULL;

-- AlterTable
ALTER TABLE "app_settings" ALTER COLUMN "price_per_print" DROP NOT NULL;
