-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PRINT', 'MERCH');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "description" TEXT,
ADD COLUMN     "kind" "ProductKind" NOT NULL DEFAULT 'PRINT';

-- AlterTable: every existing order item was a print; the default is dropped so new code must set the kind
ALTER TABLE "order_items" ADD COLUMN     "product_kind" "ProductKind" NOT NULL DEFAULT 'PRINT';
ALTER TABLE "order_items" ALTER COLUMN "product_kind" DROP DEFAULT;
