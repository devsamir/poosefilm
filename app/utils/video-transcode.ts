export function toMp4FileName(fileName: string) {
  const baseName = fileName.trim().replace(/\.[^.]+$/, "") || "video";
  return `${baseName}.mp4`;
}

export function buildFfmpegArguments(inputPath: string, outputPath: string) {
  return [
    "-y",
    "-i",
    inputPath,
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
    outputPath,
  ];
}
