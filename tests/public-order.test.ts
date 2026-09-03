import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPublicFileDownloadPath, serializePublicOrder } from "~/services/reports.server";
import { getMediaGalleryClasses } from "~/components/MediaGallery";
import { serializeOrderMedia } from "~/utils/media";

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
    const summaryPage = readFileSync(resolve(process.cwd(), "app/routes/admin.summary.tsx"), "utf8");
    const settingsPage = readFileSync(resolve(process.cwd(), "app/routes/admin.settings.tsx"), "utf8");
    const publicPage = readFileSync(resolve(process.cwd(), "app/routes/order.$code.tsx"), "utf8");
    const gallery = readFileSync(resolve(process.cwd(), "app/components/MediaGallery.tsx"), "utf8");

    expect(historyPage).toContain("to={`/admin/receipt/${order.code}`}");
    expect(historyPage).toContain('canDelete');
    expect(historyPage).toContain("Kirim WA");
    expect(queuePage).toContain('canDelete');
    expect(queuePage).toContain("Kirim WA");
    expect(settingsPage).toContain("whatsappTemplate");
    expect(summaryPage).not.toContain("Cetak rekap");
    expect(publicPage).not.toContain('canDelete');
    expect(gallery).toContain("window.confirm");
  });
});
