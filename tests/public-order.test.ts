import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPublicFileDownloadPath, serializePublicOrder } from "~/services/reports.server";
import { getMediaGalleryClasses } from "~/components/MediaGallery";
import { serializeOrderMedia } from "~/utils/media";
import { getHistoryPagination } from "~/services/reports.server";

describe("public order portal", () => {
  it("creates individual download paths for files belonging to an order", () => {
    expect(buildPublicFileDownloadPath("PB260903-01020304", 12)).toBe("/api/order/PB260903-01020304/file/12/download");
  });

  it("serializes image and video metadata without exposing storage keys", () => {
    const result = serializePublicOrder({ code: "PB260903-01020304", status: "READY", files: [{ id: 1, originalName: "a.jpg", contentType: "image/jpeg", mediaType: "IMAGE", sizeBytes: BigInt(10) }, { id: 2, originalName: "b.mp4", contentType: "video/mp4", mediaType: "VIDEO", sizeBytes: BigInt(20) }] });
    expect(result.files).toEqual([{ id: 1, originalName: "a.jpg", contentType: "image/jpeg", mediaType: "IMAGE", sizeBytes: 10, downloadUrl: "/api/order/PB260903-01020304/file/1/download" }, { id: 2, originalName: "b.mp4", contentType: "video/mp4", mediaType: "VIDEO", sizeBytes: 20, downloadUrl: "/api/order/PB260903-01020304/file/2/download" }]);
    expect(JSON.stringify(result)).not.toContain("storageKey");
  });

  it("serializes media metadata for authenticated admin previews", () => {
    expect(serializeOrderMedia("PB260903-01020304", [{ id: 4, originalName: "preview.jpg", contentType: "image/jpeg", mediaType: "IMAGE", sizeBytes: BigInt(42) }])).toEqual([{ id: 4, originalName: "preview.jpg", contentType: "image/jpeg", mediaType: "IMAGE", sizeBytes: 42, downloadUrl: "/api/order/PB260903-01020304/file/4/download" }]);
  });

  it("uses compact media classes for authenticated admin previews", () => {
    expect(getMediaGalleryClasses("compact")).toEqual({
      grid: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      frame: "aspect-[4/3] bg-[#f1ece5]",
      content: "p-3",
    });
    expect(getMediaGalleryClasses("default").frame).toBe("aspect-square bg-[#f1ece5]");
  });

  it("does not inject the obsolete Remix LiveReload socket in the Vite app shell", () => {
    const appRoot = readFileSync(resolve(process.cwd(), "app/root.tsx"), "utf8");

    expect(appRoot).not.toContain("LiveReload");
    expect(appRoot).not.toContain("8002");
  });

  it("keeps file deletion and receipt printing on authenticated admin pages", () => {
    const historyPage = readFileSync(resolve(process.cwd(), "app/routes/admin.history.tsx"), "utf8");
    const queuePage = readFileSync(resolve(process.cwd(), "app/routes/admin.queue.tsx"), "utf8");
    const uploader = readFileSync(resolve(process.cwd(), "app/components/MediaUploader.tsx"), "utf8");
    const cashierPage = readFileSync(resolve(process.cwd(), "app/routes/admin.cashier.tsx"), "utf8");
    const summaryPage = readFileSync(resolve(process.cwd(), "app/routes/admin.summary.tsx"), "utf8");
    const reportsService = readFileSync(resolve(process.cwd(), "app/services/reports.server.ts"), "utf8");
    const settingsPage = readFileSync(resolve(process.cwd(), "app/routes/admin.settings.tsx"), "utf8");
    const publicPage = readFileSync(resolve(process.cwd(), "app/routes/order.$code.tsx"), "utf8");
    const gallery = readFileSync(resolve(process.cwd(), "app/components/MediaGallery.tsx"), "utf8");
    const appShell = readFileSync(resolve(process.cwd(), "app/components/AppShell.tsx"), "utf8");
    const uploadManager = readFileSync(resolve(process.cwd(), "app/components/UploadManager.tsx"), "utf8");
    const ordersService = readFileSync(resolve(process.cwd(), "app/services/orders.server.ts"), "utf8");

    expect(historyPage).toContain("to={`/admin/receipt/${order.code}`}");
    expect(historyPage).toContain('canDelete');
    expect(historyPage).toContain("Kirim WA");
    expect(historyPage).toContain("Upload lagi");
    expect(historyPage).toContain('role="dialog"');
    expect(historyPage).toContain("aria-modal=\"true\"");
    expect(historyPage).toContain("useRevalidator");
    expect(historyPage).toContain("onUploadComplete");
    expect(historyPage).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(historyPage).toContain("FREE");
    expect(queuePage).toContain('canDelete');
    expect(queuePage).toContain("Kirim WA");
    expect(queuePage).toContain("useRevalidator");
    expect(uploader).not.toContain("window.location.reload");
    expect(appShell).toContain("UploadManagerProvider");
    expect(uploader).toContain("useUploadManager");
    expect(uploadManager).toContain("tetap aktif saat pindah tab");
    expect(cashierPage).toContain('name="isRealTransaction"');
    expect(cashierPage).toContain("isRealTransaction");
    expect(reportsService).toContain("isRealTransaction");
    expect(settingsPage).toContain("whatsappTemplate");
    expect(summaryPage).not.toContain("Cetak rekap");
    expect(publicPage).not.toContain('canDelete');
    expect(gallery).toContain("window.confirm");
    expect(historyPage).toContain("requireSuperadmin");
    expect(historyPage).toContain('name="intent" value="delete"');
    expect(historyPage).toContain("deleteDeliveredOrder");
    expect(historyPage).toContain("totalPages");
    expect(ordersService).toContain("deleteObjectIfPresent");
  });

  it("normalizes history pagination and clamps pages to the available range", () => {
    expect(getHistoryPagination(0, 12)).toEqual({ page: 1, pageSize: 12, totalPages: 1, skip: 0 });
    expect(getHistoryPagination(2, 12, 25)).toEqual({ page: 2, pageSize: 12, totalPages: 3, skip: 12 });
    expect(getHistoryPagination(99, 12, 25)).toEqual({ page: 3, pageSize: 12, totalPages: 3, skip: 24 });
  });
});
