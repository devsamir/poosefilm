-- AlterTable
ALTER TABLE "orders" DROP COLUMN "quantity",
DROP COLUMN "unit_price";

-- AlterTable
ALTER TABLE "app_settings" DROP COLUMN "price_per_print";
