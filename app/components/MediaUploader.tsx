import { useEffect, useRef, useState } from "react";

import { getUploadBatchState, isUploadInProgress, useUploadManager } from "~/components/UploadManager";

type UploadStatus = { name: string; progress: number; error?: string };
type UploadCompletionAction = "none" | "callback";

export function shouldCompleteAfterUploads(statuses: UploadStatus[]) {
  return statuses.length > 0 && statuses.every((status) => !status.error && status.progress === 100);
}

export function getUploadCompletionAction(statuses: UploadStatus[], hasCompletionCallback: boolean): UploadCompletionAction {
  if (!shouldCompleteAfterUploads(statuses) || !hasCompletionCallback) return "none";
  return "callback";
}

const defaultAccept = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";
const defaultDescription = "Format: JPG, PNG, WebP, MP4, MOV, atau WebM. Maksimal gambar 25 MB dan video 500 MB.";

export function MediaUploader({ orderCode, accept = defaultAccept, description = defaultDescription, buttonLabel = "Pilih foto / video", onUploadComplete }: { orderCode: string; accept?: string; description?: string; buttonLabel?: string; onUploadComplete?: () => void }) {
  const { jobs, enqueueUploads } = useUploadManager();
  const orderJobs = jobs.filter((job) => job.orderCode === orderCode);
  const busy = isUploadInProgress(orderJobs);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const completionReported = useRef(false);

  useEffect(() => {
    const currentBatchJobs = activeBatchId ? orderJobs.filter((job) => job.batchId === activeBatchId) : [];
    if (onUploadComplete && !completionReported.current && getUploadBatchState(currentBatchJobs) === "COMPLETED") {
      completionReported.current = true;
      onUploadComplete();
    }
  }, [activeBatchId, onUploadComplete, orderJobs]);

  function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    completionReported.current = false;
    const { batchId } = enqueueUploads(orderCode, Array.from(files));
    setActiveBatchId(batchId);
  }

  const visibleJobs = activeBatchId ? orderJobs.filter((job) => job.batchId === activeBatchId) : orderJobs.filter((job) => job.state !== "COMPLETED");
  return <div className="mt-5 rounded-xl border border-dashed border-[#d9d0c4] p-4"><label className="button-secondary inline-flex cursor-pointer text-sm">{busy ? "Mengupload..." : buttonLabel}<input className="hidden" type="file" accept={accept} multiple disabled={busy} onChange={(event) => { handleUpload(event.target.files); event.currentTarget.value = ""; }} /></label>{visibleJobs.length ? <div className="mt-4 space-y-2">{visibleJobs.map((job) => <div key={job.id} className="text-xs"><div className="flex justify-between gap-3"><span className="truncate">{job.fileName}</span><span>{job.error || `${job.progress}%`}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eee7df]"><div className={`h-full rounded-full ${job.error ? "bg-red-500" : "bg-[#25231f]"}`} style={{ width: `${job.error ? 100 : job.progress}%` }} /></div></div>)}</div> : <p className="mt-3 text-xs leading-5 text-[#968b7e]">{description}</p>}</div>;
}
