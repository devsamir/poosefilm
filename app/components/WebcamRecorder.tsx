import { useCallback, useEffect, useRef, useState } from "react";

import { useUploadManager } from "~/components/UploadManager";
import {
  getSupportedRecordingMimeType,
  getWebcamFileExtension,
  MAX_WEBCAM_RECORDING_SECONDS,
  normalizeWebcamMimeType,
} from "~/utils/webcam";

type WebcamRecorderProps = {
  orderCode: string;
  customerName: string;
  onClose: () => void;
  onUploadComplete?: () => void;
};

type RecorderStatus = "requesting" | "ready" | "recording" | "review" | "uploading";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function WebcamRecorder({ orderCode, customerName, onClose, onUploadComplete }: WebcamRecorderProps) {
  const { enqueueUploads } = useUploadManager();
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const reviewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const [status, setStatus] = useState<RecorderStatus>("requesting");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
  }, []);

  const requestCamera = useCallback(async () => {
    setStatus("requesting");
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser ini tidak mendukung akses webcam.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => undefined);
      }
      setStatus("ready");
    } catch {
      stopStream();
      setError("Akses kamera dan mikrofon ditolak. Izinkan perangkat di browser lalu coba lagi.");
    }
  }, [stopStream]);

  useEffect(() => {
    void requestCamera();
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current = null;
      stopStream();
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, [requestCamera, stopStream]);

  function finishRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) {
      setError("Kamera belum siap. Coba izinkan akses kamera dan mikrofon terlebih dahulu.");
      return;
    }

    setError(null);
    chunksRef.current = [];
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    const preferredMimeType = getSupportedRecordingMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: preferredMimeType });
    } catch {
      recorder = new MediaRecorder(stream);
    }

    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      setStatus("ready");
      setError("Perekaman gagal. Periksa kamera dan mikrofon lalu coba lagi.");
    };
    recorder.onstop = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      const mimeType = normalizeWebcamMimeType(recorder.mimeType || preferredMimeType);
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = url;
      setRecordedBlob(blob);
      setRecordedUrl(url);
      setStatus("review");
      stopStream();
      recorderRef.current = null;
    };
    recorder.start(250);
    setStatus("recording");
    timerRef.current = window.setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);
      if (elapsedRef.current >= MAX_WEBCAM_RECORDING_SECONDS) finishRecording();
    }, 1000);
  }

  function discardRecording() {
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    recordedUrlRef.current = null;
    setRecordedUrl(null);
    setRecordedBlob(null);
    setElapsedSeconds(0);
    void requestCamera();
  }

  function uploadRecording() {
    if (!recordedBlob) return;
    const mimeType = normalizeWebcamMimeType(recordedBlob.type);
    const extension = getWebcamFileExtension(mimeType);
    const file = new File([recordedBlob], `webcam-${Date.now()}.${extension}`, { type: mimeType });
    setStatus("uploading");
    enqueueUploads(orderCode, [file], onUploadComplete);
    onClose();
  }

  const isBusy = status === "requesting" || status === "recording" || status === "uploading";
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#25231f]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="webcam-recorder-title">
    <section className="w-full max-w-2xl rounded-3xl border border-[#e6ded2] bg-[#fffdfa] p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">WEBCAM VIDEO</p>
          <h2 id="webcam-recorder-title" className="mt-2 font-display text-3xl">Rekam untuk {customerName}</h2>
          <p className="mt-1 text-sm text-[#84796c]">Order {orderCode} · video + audio · maksimal 60 detik</p>
        </div>
        <button className="button-secondary shrink-0" type="button" onClick={onClose} disabled={status === "uploading"}>Tutup</button>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl bg-[#171614]">
        {status === "review" && recordedUrl ? <video ref={reviewVideoRef} className="aspect-video w-full object-contain" src={recordedUrl} controls playsInline /> : <video ref={liveVideoRef} className="aspect-video w-full object-contain" autoPlay muted playsInline />}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className={`status-pill ${status === "recording" ? "status-waiting" : "status-ready"}`}>
          {status === "requesting" ? "Meminta izin perangkat" : status === "recording" ? "Sedang merekam" : status === "review" ? "Preview rekaman" : status === "uploading" ? "Menyiapkan upload" : "Siap merekam"}
        </span>
        <span className="font-mono text-[#84796c]">{formatDuration(elapsedSeconds)} / 01:00</span>
      </div>

      {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {status === "requesting" && !error ? <span className="self-center text-sm text-[#84796c]">Izinkan kamera dan mikrofon di browser…</span> : null}
        {status === "requesting" && error ? <button className="button-secondary" type="button" onClick={() => void requestCamera()}>Coba lagi</button> : null}
        {status === "ready" ? <button className="button-primary" type="button" onClick={startRecording}>Mulai rekam</button> : null}
        {status === "recording" ? <button className="button-primary" type="button" onClick={finishRecording}>Selesai rekam</button> : null}
        {status === "review" ? <><button className="button-secondary" type="button" onClick={discardRecording}>Rekam ulang</button><button className="button-secondary" type="button" onClick={discardRecording}>Buang</button><button className="button-primary" type="button" onClick={uploadRecording}>Upload ke order</button></> : null}
        {status === "uploading" ? <span className="self-center text-sm text-[#84796c]">Upload berjalan di background…</span> : null}
      </div>
    </section>
  </div>;
}
