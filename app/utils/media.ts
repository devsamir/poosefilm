export type OrderMediaRecord = {
  id: number;
  originalName: string;
  contentType: string;
  mediaType: string;
  sizeBytes: bigint;
};

export function serializeOrderMedia(code: string, files: OrderMediaRecord[]) {
  return files.map((file) => ({
    id: file.id,
    originalName: file.originalName,
    contentType: file.contentType,
    mediaType: file.mediaType,
    sizeBytes: Number(file.sizeBytes),
    downloadUrl: `/api/order/${code}/file/${file.id}/download`,
  }));
}
