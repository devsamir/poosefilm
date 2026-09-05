import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MAX_WEBCAM_RECORDING_SECONDS, getSupportedRecordingMimeType, normalizeWebcamMimeType } from "~/utils/webcam";

describe("webcam recorder", () => {
  it("limits browser recordings to 60 seconds", () => {
    expect(MAX_WEBCAM_RECORDING_SECONDS).toBe(60);
  });

  it("selects an audio-capable browser recording format", () => {
    expect(getSupportedRecordingMimeType((mimeType) => mimeType === "video/webm;codecs=vp8,opus")).toBe("video/webm;codecs=vp8,opus");
    expect(normalizeWebcamMimeType("video/webm;codecs=vp9,opus")).toBe("video/webm");
  });

  it("keeps the recorder on the existing R2 upload path", () => {
    const component = readFileSync(resolve(process.cwd(), "app/components/WebcamRecorder.tsx"), "utf8");
    const queue = readFileSync(resolve(process.cwd(), "app/routes/admin.queue.tsx"), "utf8");

    expect(component).toContain("getUserMedia");
    expect(component).toContain("audio: true");
    expect(component).toContain("MediaRecorder");
    expect(component).toContain("enqueueUploads");
    expect(queue).toContain("WebcamRecorder");
    expect(queue).toContain("Rekam webcam");
  });
});
