import { useState } from "react";

type UploadStatus = { name: string; progress: number; error?: string };

export function shouldReloadAfterUploads(statuses: UploadStatus[]) {
  return statuses.length > 0 && statuses.every((status) => !status.error && status.progress === 100);
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

export function MediaUploader({ orderCode }: { orderCode: string }) {
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const nextStatuses: UploadStatus[] = Array.from(files).map((file) => ({ name: file.name, progress: 0 }));
    setStatuses(nextStatuses);
    for (const [index, file] of Array.from(files).entries()) {
      try {
        const presignResponse = await fetch(`/api/orders/${orderCode}/presign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ originalName: file.name, contentType: file.type, sizeBytes: file.size }) });
        const presign = await presignResponse.json();
        if (!presignResponse.ok) throw new Error(presign.error || "Gagal menyiapkan upload.");
        await putWithProgress(presign.uploadUrl, file, (progress) => setStatuses((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, progress } : item)));
        nextStatuses[index] = { ...nextStatuses[index], progress: 100 };
        setStatuses((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, progress: 100 } : item));
        const completeResponse = await fetch(`/api/orders/${orderCode}/files/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: presign.key, originalName: file.name, contentType: file.type, sizeBytes: file.size }) });
        const complete = await completeResponse.json();
        if (!completeResponse.ok) throw new Error(complete.error || "Gagal mencatat file.");
      } catch (error) {
        nextStatuses[index] = { ...nextStatuses[index], error: error instanceof Error ? error.message : "Upload gagal.", progress: 0 };
        setStatuses((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, error: error instanceof Error ? error.message : "Upload gagal." } : item));
      }
    }
    setBusy(false);
    if (shouldReloadAfterUploads(nextStatuses)) window.location.reload();
  }

  return <div className="mt-5 rounded-xl border border-dashed border-[#d9d0c4] p-4"><label className="button-secondary inline-flex cursor-pointer text-sm">{busy ? "Mengupload..." : "Pilih foto / video"}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple disabled={busy} onChange={(event) => { void handleUpload(event.target.files); event.currentTarget.value = ""; }} /></label>{statuses.length ? <div className="mt-4 space-y-2">{statuses.map((status) => <div key={status.name} className="text-xs"><div className="flex justify-between gap-3"><span className="truncate">{status.name}</span><span>{status.error || `${status.progress}%`}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eee7df]"><div className={`h-full rounded-full ${status.error ? "bg-red-500" : "bg-[#25231f]"}`} style={{ width: `${status.error ? 100 : status.progress}%` }} /></div></div>)}</div> : <p className="mt-3 text-xs leading-5 text-[#968b7e]">Format: JPG, PNG, WebP, MP4, MOV, atau WebM. Maksimal gambar 25 MB dan video 500 MB.</p>}</div>;
}
