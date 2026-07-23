"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile } from "@/lib/client/upload";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mic, Square, Trash2, Loader2, CheckCircle2 } from "lucide-react";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Record a voice note in the browser (WhatsApp-style) and upload it to R2.
 * `value` is the stored media_key; `onChange(key|null)` reports save/remove.
 */
export function VoiceRecorder({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        await upload(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      toast.error("Please allow microphone access to record a voice note.");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function upload(blob: Blob) {
    setUploading(true);
    try {
      const ext = (blob.type.split(";")[0].split("/")[1] || "webm").slice(0, 4);
      const file = new File([blob], `voice-note.${ext}`, {
        type: blob.type.split(";")[0],
      });
      const uploaded = await uploadFile(file, "voice_note");
      onChange(uploaded.key);
      toast.success("Voice note saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsed(0);
    onChange(null);
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        {!recording ? (
          <Button type="button" variant="outline" size="sm" onClick={start} disabled={uploading}>
            <Mic className="size-4" /> {value || previewUrl ? "Re-record" : "Record"}
          </Button>
        ) : (
          <Button type="button" variant="destructive" size="sm" onClick={stop}>
            <Square className="size-4" /> Stop
          </Button>
        )}

        {recording && (
          <span className="flex items-center gap-2 text-sm font-medium text-destructive">
            <span className="size-2 animate-pulse rounded-full bg-destructive" />
            Recording… {fmt(elapsed)}
          </span>
        )}
        {uploading && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Saving…
          </span>
        )}
        {!recording && !uploading && value && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="size-4" /> Voice note saved
          </span>
        )}
        {(value || previewUrl) && !recording && !uploading && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={remove}
            aria-label="Remove voice note"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}
      </div>

      {previewUrl && (
        <audio controls src={previewUrl} className="h-9 w-full" />
      )}
    </div>
  );
}
