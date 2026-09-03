import { describe, expect, it } from "vitest";

import { shouldReloadAfterUploads } from "~/components/MediaUploader";

describe("media uploader feedback", () => {
  it("reloads only when every selected file completed", () => {
    expect(shouldReloadAfterUploads([{ name: "a.jpg", progress: 100 }])).toBe(true);
    expect(shouldReloadAfterUploads([{ name: "a.jpg", progress: 100 }, { name: "b.mp4", progress: 0, error: "Upload gagal." }])).toBe(false);
  });
});
