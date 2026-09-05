-- CreateEnum
CREATE TYPE "OrderFileVariantKind" AS ENUM ('ORIGINAL', 'FILTERED');

-- CreateEnum
CREATE TYPE "FilterRenderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- ExtendEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING_FILTER';

-- CreateTable
CREATE TABLE "filter_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "preview_color" TEXT DEFAULT '#FFFFFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_template_values" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "filter_type" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "filter_template_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_packages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filter_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_package_items" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "filter_template_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "filter_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_filter_snapshots" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "filter_template_id" INTEGER,
    "filter_name" TEXT NOT NULL,
    "filter_css" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "order_filter_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_render_jobs" (
    "id" SERIAL NOT NULL,
    "source_file_id" INTEGER NOT NULL,
    "status" "FilterRenderStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filter_render_jobs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "filter_package_id" INTEGER;

-- AlterTable
ALTER TABLE "order_files" ADD COLUMN "variant_kind" "OrderFileVariantKind" NOT NULL DEFAULT 'ORIGINAL';
ALTER TABLE "order_files" ADD COLUMN "source_file_id" INTEGER;
ALTER TABLE "order_files" ADD COLUMN "filter_snapshot_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "filter_templates_name_key" ON "filter_templates"("name");
CREATE UNIQUE INDEX "filter_template_values_template_id_filter_type_key" ON "filter_template_values"("template_id", "filter_type");
CREATE UNIQUE INDEX "filter_packages_name_key" ON "filter_packages"("name");
CREATE UNIQUE INDEX "filter_package_items_package_id_filter_template_id_key" ON "filter_package_items"("package_id", "filter_template_id");
CREATE UNIQUE INDEX "filter_package_items_package_id_sort_order_key" ON "filter_package_items"("package_id", "sort_order");
CREATE UNIQUE INDEX "order_filter_snapshots_order_id_sort_order_key" ON "order_filter_snapshots"("order_id", "sort_order");
CREATE UNIQUE INDEX "filter_render_jobs_source_file_id_key" ON "filter_render_jobs"("source_file_id");
CREATE UNIQUE INDEX "order_files_source_file_id_filter_snapshot_id_key" ON "order_files"("source_file_id", "filter_snapshot_id");

-- CreateIndex
CREATE INDEX "filter_render_jobs_status_available_at_idx" ON "filter_render_jobs"("status", "available_at");
CREATE INDEX "order_files_source_file_id_idx" ON "order_files"("source_file_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_filter_package_id_fkey" FOREIGN KEY ("filter_package_id") REFERENCES "filter_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "filter_template_values" ADD CONSTRAINT "filter_template_values_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "filter_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "filter_package_items" ADD CONSTRAINT "filter_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "filter_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "filter_package_items" ADD CONSTRAINT "filter_package_items_filter_template_id_fkey" FOREIGN KEY ("filter_template_id") REFERENCES "filter_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_filter_snapshots" ADD CONSTRAINT "order_filter_snapshots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_filter_snapshots" ADD CONSTRAINT "order_filter_snapshots_filter_template_id_fkey" FOREIGN KEY ("filter_template_id") REFERENCES "filter_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_source_file_id_fkey" FOREIGN KEY ("source_file_id") REFERENCES "order_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_filter_snapshot_id_fkey" FOREIGN KEY ("filter_snapshot_id") REFERENCES "order_filter_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "filter_render_jobs" ADD CONSTRAINT "filter_render_jobs_source_file_id_fkey" FOREIGN KEY ("source_file_id") REFERENCES "order_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
