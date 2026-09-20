import { useEffect, useRef, type ReactNode } from "react";

export function SettingsModal({ title, description, eyebrow = "Poosefilm settings", open, onClose, children }: { title: string; description?: string; eyebrow?: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? closeButtonRef.current)?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#172126]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="flex max-h-[min(880px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-[#e5ddce] bg-[#fffdf9] shadow-[0_24px_80px_rgba(31,37,40,0.24)]" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title"><header className="flex items-start justify-between gap-6 border-b border-[#ebe3d6] px-6 py-5 sm:px-8"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b17a2c]">{eyebrow}</p><h2 id="settings-modal-title" className="mt-2 font-display text-3xl tracking-tight text-[#1f2528]">{title}</h2>{description ? <p className="mt-2 max-w-xl text-sm leading-6 text-[#667177]">{description}</p> : null}</div><button ref={closeButtonRef} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ded5c8] text-xl text-[#667177] transition hover:border-[#1f2528] hover:text-[#1f2528]" type="button" onClick={onClose} aria-label="Tutup dialog">×</button></header><div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-8">{children}</div></section></div>;
}
