import { describe, expect, it } from "vitest";

import { getUploadBatchState, isUploadInProgress } from "~/utils/upload-manager";

describe("global upload manager state", () => {
  it("keeps a batch active while at least one file is queued or uploading", () => {
    expect(isUploadInProgress([{ state: "QUEUED" }, { state: "COMPLETED" }])).toBe(true);
    expect(isUploadInProgress([{ state: "UPLOADING" }])).toBe(true);
    expect(isUploadInProgress([{ state: "COMPLETED" }, { state: "ERROR" }])).toBe(false);
  });

  it("reports completion only when every file in the batch succeeded", () => {
    expect(getUploadBatchState([{ state: "COMPLETED" }, { state: "COMPLETED" }])).toBe("COMPLETED");
    expect(getUploadBatchState([{ state: "COMPLETED" }, { state: "ERROR" }])).toBe("ERROR");
    expect(getUploadBatchState([{ state: "UPLOADING" }])).toBe("UPLOADING");
    expect(getUploadBatchState([])).toBe("IDLE");
  });
});
