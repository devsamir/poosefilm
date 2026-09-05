export function shouldRenderFilters(mediaType: string, snapshotCount: number) {
  return mediaType === "IMAGE" && snapshotCount > 0;
}

export function buildDerivedFilterStorageKey(orderCode: string, sourceFileId: number, filterSnapshotId: number) {
  const safeCode = orderCode.replace(/[^a-zA-Z0-9_-]/g, "");
  return `orders/${safeCode}/filtered/${sourceFileId}-${filterSnapshotId}.jpg`;
}

export function getRetryDelayMs(attemptCount: number) {
  if (attemptCount <= 1) return 0;
  return Math.min(2 ** (attemptCount - 2) * 30_000, 120_000);
}
