export type OrderMediaRecord = {
  id: number;
  originalName: string;
  contentType: string;
  mediaType: string;
  sizeBytes: bigint;
  variantKind?: string;
  filterSnapshot?: { filterName: string } | null;
  renderJob?: { status: string } | null;
};

export function serializeOrderMedia(code: string, files: OrderMediaRecord[]) {
  return files.filter((file) => file.variantKind !== "FILTERED" || !file.renderJob || file.renderJob.status === "COMPLETED").map((file) => {
    const serialized = {
      id: file.id,
      originalName: file.originalName,
      contentType: file.contentType,
      mediaType: file.mediaType,
      sizeBytes: Number(file.sizeBytes),
      downloadUrl: `/api/order/${code}/file/${file.id}/download`,
    };
    return file.variantKind || file.filterSnapshot || file.renderJob ? { ...serialized, variantKind: file.variantKind || "ORIGINAL", filterName: file.filterSnapshot?.filterName || null, renderStatus: file.renderJob?.status || null } : serialized;
  });
}
