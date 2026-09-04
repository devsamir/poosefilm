import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getMediaFileDeletePath } from "~/components/MediaGallery";
import { buildOrderStorageKey, getOrderStatusAfterFileDeletion, validateMediaInput } from "~/services/order-files.server";
import { isMissingObjectError } from "~/services/r2.server";

describe("order media uploads", () => {
  it("accepts supported images and videos within their limits", () => {
    expect(validateMediaInput({ originalName: "photo.jpg", contentType: "image/jpeg", sizeBytes: 1000 })).toEqual({ mediaType: "IMAGE" });
    expect(validateMediaInput({ originalName: "clip.mp4", contentType: "video/mp4", sizeBytes: 1000 })).toEqual({ mediaType: "VIDEO" });
  });

  it("rejects files over the media-specific limits", () => {
    expect(() => validateMediaInput({ originalName: "photo.jpg", contentType: "image/jpeg", sizeBytes: 25 * 1024 * 1024 + 1 })).toThrow();
    expect(() => validateMediaInput({ originalName: "clip.mp4", contentType: "video/mp4", sizeBytes: 500 * 1024 * 1024 + 1 })).toThrow();
  });

  it("scopes generated keys under the public order code", () => {
    expect(buildOrderStorageKey("PB260903-01020304", "My photo 01.jpg", "fixed-id")).toBe("orders/PB260903-01020304/fixed-id-My-photo-01.jpg");
  });

  it("builds the authenticated delete endpoint for one order file", () => {
    expect(getMediaFileDeletePath("PB260903-01020304", 12)).toBe("/api/orders/PB260903-01020304/files/12");
  });

  it("recognizes missing R2 objects so database cleanup can continue", () => {
    expect(isMissingObjectError({ name: "NotFound" })).toBe(true);
    expect(isMissingObjectError({ $metadata: { httpStatusCode: 404 } })).toBe(true);
    expect(isMissingObjectError({ name: "AccessDenied" })).toBe(false);
  });

  it("returns an upload-waiting order when its last ready file is deleted", () => {
    expect(getOrderStatusAfterFileDeletion("READY", 0)).toBe("WAITING_UPLOAD");
    expect(getOrderStatusAfterFileDeletion("READY", 1)).toBe("READY");
    expect(getOrderStatusAfterFileDeletion("DELIVERED", 0)).toBe("DELIVERED");
  });

  it("allows additional uploads to delivered orders", () => {
    const serviceSource = readFileSync(resolve(process.cwd(), "app/services/order-files.server.ts"), "utf8");
    expect(serviceSource).not.toContain('if (order.status === "DELIVERED") throw new Error("Order sudah selesai.");');
  });
});
