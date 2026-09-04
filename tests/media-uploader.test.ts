import { describe, expect, it } from "vitest";

import { getUploadCompletionAction, shouldCompleteAfterUploads } from "~/components/MediaUploader";

describe("media uploader feedback", () => {
  it("completes only when every selected file finished", () => {
    expect(shouldCompleteAfterUploads([{ name: "a.jpg", progress: 100 }])).toBe(true);
    expect(shouldCompleteAfterUploads([{ name: "a.jpg", progress: 100 }, { name: "b.mp4", progress: 0, error: "Upload gagal." }])).toBe(false);
  });

  it("uses a completion callback instead of a full reload when provided", () => {
    const completed = [{ name: "a.jpg", progress: 100 }];
    expect(getUploadCompletionAction(completed, true)).toBe("callback");
    expect(getUploadCompletionAction(completed, false)).toBe("none");
    expect(getUploadCompletionAction([{ name: "a.jpg", progress: 0 }], true)).toBe("none");
  });
});
