import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { getUploadBatchState, isUploadInProgress, type UploadJob, type UploadJobState } from "~/utils/upload-manager";

type UploadManagerValue = {
  jobs: UploadJob[];
  enqueueUploads: (orderCode: string, files: File[], onComplete?: () => void) => { batchId: string; jobIds: string[] };
};

const UploadManagerContext = createContext<UploadManagerValue | null>(null);

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function updateJobState(setJobs: React.Dispatch<React.SetStateAction<UploadJob[]>>, id: string, state: UploadJobState, progress: number, error?: string) {
  setJobs((current) => current.map((job) => job.id === id ? { ...job, state, progress, ...(error ? { error } : {}) } : job));
}

function putWithProgress(url: string, file: File, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Upload ke storage gagal."));
    request.onerror = () => reject(new Error("Upload ke storage gagal."));
    request.send(file);
  });
}

async function readJson(response: Response) {
  try {
    return await response.json() as { error?: string; uploadUrl?: string; key?: string };
  } catch {
    return {};
  }
}

function UploadTray({ jobs }: { jobs: UploadJob[] }) {
  const visibleJobs = jobs.filter((job) => job.state !== "COMPLETED").slice(-5);
  if (!visibleJobs.length) return null;
  const activeCount = visibleJobs.filter((job) => job.state === "QUEUED" || job.state === "UPLOADING").length;

  return <aside className="fixed bottom-5 right-5 z-30 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-[#e6ded2] bg-white p-4 shadow-xl" aria-live="polite" aria-label="Status upload global">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold">{activeCount ? `Upload berjalan (${activeCount})` : "Upload perlu perhatian"}</p>
      <span className="text-xs text-[#968b7e]">tetap aktif saat pindah tab</span>
    </div>
    <div className="mt-3 space-y-2">
      {visibleJobs.map((job) => <div key={job.id} className="text-xs">
        <div className="flex justify-between gap-3"><span className="truncate">{job.fileName}</span><span className={job.state === "ERROR" ? "text-red-700" : "text-[#84796c]"}>{job.state === "ERROR" ? "Gagal" : `${job.progress}%`}</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eee7df]"><div className={`h-full rounded-full ${job.state === "ERROR" ? "bg-red-500" : "bg-[#25231f]"}`} style={{ width: `${job.state === "ERROR" ? 100 : job.progress}%` }} /></div>
        {job.error ? <p className="mt-1 text-red-700">{job.error}</p> : null}
      </div>)}
    </div>
  </aside>;
}

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  const processBatch = useCallback(async (orderCode: string, files: File[], jobIds: string[], onComplete?: () => void) => {
    let hasError = false;
    for (const [index, file] of files.entries()) {
      const jobId = jobIds[index];
      if (!jobId) continue;
      updateJobState(setJobs, jobId, "UPLOADING", 0);
      try {
        const presignResponse = await fetch(`/api/orders/${orderCode}/presign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ originalName: file.name, contentType: file.type, sizeBytes: file.size }) });
        const presign = await readJson(presignResponse);
        if (!presignResponse.ok || !presign.uploadUrl || !presign.key) throw new Error(presign.error || "Gagal menyiapkan upload.");
        await putWithProgress(presign.uploadUrl, file, (progress) => updateJobState(setJobs, jobId, "UPLOADING", progress));
        const completeResponse = await fetch(`/api/orders/${orderCode}/files/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: presign.key, originalName: file.name, contentType: file.type, sizeBytes: file.size }) });
        const complete = await readJson(completeResponse);
        if (!completeResponse.ok) throw new Error(complete.error || "Gagal mencatat file.");
        updateJobState(setJobs, jobId, "COMPLETED", 100);
      } catch (error) {
        hasError = true;
        updateJobState(setJobs, jobId, "ERROR", 0, error instanceof Error ? error.message : "Upload gagal.");
      }
    }
    if (!hasError) onComplete?.();
  }, []);

  const enqueueUploads = useCallback((orderCode: string, files: File[], onComplete?: () => void) => {
    const batchId = createClientId("batch");
    const newJobs = files.map((file) => ({ id: createClientId("upload"), batchId, orderCode, fileName: file.name, progress: 0, state: "QUEUED" as const }));
    setJobs((current) => [...current, ...newJobs]);
    void processBatch(orderCode, files, newJobs.map((job) => job.id), onComplete);
    return { batchId, jobIds: newJobs.map((job) => job.id) };
  }, [processBatch]);

  const value = useMemo(() => ({ jobs, enqueueUploads }), [enqueueUploads, jobs]);
  return <UploadManagerContext.Provider value={value}>{children}<UploadTray jobs={jobs} /></UploadManagerContext.Provider>;
}

export function useUploadManager() {
  const context = useContext(UploadManagerContext);
  if (!context) throw new Error("useUploadManager harus digunakan di dalam UploadManagerProvider.");
  return context;
}

export { getUploadBatchState, isUploadInProgress };
