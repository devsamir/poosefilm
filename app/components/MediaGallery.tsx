import { useRevalidator } from "@remix-run/react";
import { useState } from "react";

export type MediaGalleryVariant = "default" | "compact";

export function getMediaFileDeletePath(code: string, fileId: number) {
  return `/api/orders/${encodeURIComponent(code)}/files/${fileId}`;
}

export function getMediaGalleryClasses(variant: MediaGalleryVariant = "default") {
  return variant === "compact"
    ? {
        grid: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        frame: "aspect-[4/3] bg-[#f1ece5]",
        content: "p-3",
      }
    : {
        grid: "grid gap-5 sm:grid-cols-2",
        frame: "aspect-square bg-[#f1ece5]",
        content: "p-4",
      };
}

export function MediaGallery({ code, files, variant = "default", canDelete = false }: { code: string; files: Array<{ id: number; originalName: string; contentType: string; mediaType: string; sizeBytes: number; downloadUrl: string }>; variant?: MediaGalleryVariant; canDelete?: boolean }) {
  const classes = getMediaGalleryClasses(variant);
  const revalidator = useRevalidator();
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(file: { id: number; originalName: string }) {
    if (!window.confirm(`Hapus file ${file.originalName}? File akan dihapus dari hasil customer.`)) return;

    setDeletingFileId(file.id);
    setDeleteError(null);
    try {
      const response = await fetch(getMediaFileDeletePath(code, file.id), { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal menghapus file.");
      revalidator.revalidate();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Gagal menghapus file.");
    } finally {
      setDeletingFileId(null);
    }
  }

  return <div>{deleteError ? <p className="mb-3 text-sm text-red-700">{deleteError}</p> : null}<div className={classes.grid}>{files.map((file) => <article key={file.id} className="overflow-hidden rounded-2xl border border-[#e6ded2] bg-white"><div className={classes.frame}>{file.mediaType === "IMAGE" ? <img className="h-full w-full object-cover" src={file.downloadUrl} alt={file.originalName} /> : <video className="h-full w-full object-cover" src={file.downloadUrl} controls preload="metadata" />}</div><div className={`flex items-center justify-between gap-3 ${classes.content}`}><div className="min-w-0"><p className="truncate text-sm font-semibold">{file.originalName}</p><p className="mt-1 text-xs text-[#968b7e]">{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</p></div><div className="flex shrink-0 gap-2"><a className="button-secondary text-xs" href={`${file.downloadUrl}?download=1`}>Download</a>{canDelete ? <button className="button-secondary text-xs text-red-700" type="button" disabled={deletingFileId !== null} onClick={() => { void handleDelete(file); }}>{deletingFileId === file.id ? "Menghapus..." : "Hapus"}</button> : null}</div></div></article>)}</div></div>;
}
