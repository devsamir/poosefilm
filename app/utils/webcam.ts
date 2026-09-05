export const MAX_WEBCAM_RECORDING_SECONDS = 60;

export const WEBCAM_VIDEO_CONSTRAINTS = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 30 },
} as const;

const preferredRecordingMimeTypes = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

export function getSupportedRecordingMimeType(isTypeSupported?: (mimeType: string) => boolean) {
  const supports = isTypeSupported
    ?? (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function"
      ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
      : () => false);

  return preferredRecordingMimeTypes.find((mimeType) => supports(mimeType)) || "video/webm";
}

export function normalizeWebcamMimeType(mimeType: string) {
  const baseMimeType = mimeType.split(";")[0]?.trim().toLowerCase();
  return baseMimeType === "video/mp4" ? "video/mp4" : "video/webm";
}

export function getWebcamFileExtension(mimeType: string) {
  return normalizeWebcamMimeType(mimeType) === "video/mp4" ? "mp4" : "webm";
}
