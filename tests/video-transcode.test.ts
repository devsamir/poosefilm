import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildFfmpegArguments, toMp4FileName } from "~/utils/video-transcode";

describe("server-side video transcoding", () => {
  it("uses an MP4 filename while preserving optional audio", () => {
    expect(toMp4FileName("webcam-123.webm")).toBe("webcam-123.mp4");
    expect(buildFfmpegArguments("input.webm", "output.mp4")).toEqual([
      "-y",
      "-i",
      "input.webm",
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      "scale=w=min(1920\\,iw):h=min(1080\\,ih):force_original_aspect_ratio=decrease",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
  });

  it("keeps conversion on the server before the final database record", () => {
    const service = readFileSync(resolve(process.cwd(), "app/services/order-files.server.ts"), "utf8");

    expect(service).toContain("getObjectBuffer");
    expect(service).toContain("execFile");
    expect(service).toContain("putObject");
    expect(service).toContain('contentType: "video/mp4"');
  });

  it("does not delete a database source record that was never created", () => {
    const service = readFileSync(resolve(process.cwd(), "app/services/order-files.server.ts"), "utf8");

    expect(service).not.toContain("orderId_storageKey");
  });
});
