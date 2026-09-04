export type UploadJobState = "QUEUED" | "UPLOADING" | "COMPLETED" | "ERROR";

export type UploadJob = {
  id: string;
  batchId: string;
  orderCode: string;
  fileName: string;
  progress: number;
  state: UploadJobState;
  error?: string;
};

export function isUploadInProgress(jobs: Array<Pick<UploadJob, "state">>) {
  return jobs.some((job) => job.state === "QUEUED" || job.state === "UPLOADING");
}

export function getUploadBatchState(jobs: Array<Pick<UploadJob, "state">>) {
  if (!jobs.length) return "IDLE" as const;
  if (jobs.some((job) => job.state === "ERROR")) return "ERROR" as const;
  if (jobs.every((job) => job.state === "COMPLETED")) return "COMPLETED" as const;
  return "UPLOADING" as const;
}
