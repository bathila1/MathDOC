"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitProof } from "@/features/tasks/server/actions";
import { uploadFile, type UploadedFile } from "@/lib/client/upload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Paperclip, Play, RotateCcw, Square, Timer, Trash2, Upload } from "lucide-react";

function fmt(sec: number): string {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${sec < 0 ? "+" : ""}${m}:${s.toString().padStart(2, "0")}`;
}

/** Optional countdown timer for a timed paper. Reports the time taken up. */
function TaskTimerBox({
  timerSeconds,
  onElapsed,
}: {
  timerSeconds: number;
  onElapsed: (seconds: number | null) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "running" | "stopped">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [restarted, setRestarted] = useState(false);
  const startRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  function start() {
    startRef.current = Date.now();
    setElapsed(0);
    onElapsed(0);
    setPhase("running");
    intervalRef.current = setInterval(() => {
      const e = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(e);
      onElapsed(e);
    }, 1000);
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const e = Math.floor((Date.now() - startRef.current) / 1000);
    setElapsed(e);
    onElapsed(e);
    setPhase("stopped");
  }

  function restart() {
    setRestarted(true);
    setPhase("idle");
    setElapsed(0);
    onElapsed(null);
  }

  const remaining = timerSeconds - elapsed;

  return (
    <div className="space-y-2 rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Timer className="size-4" /> Timed task — {Math.round(timerSeconds / 60)} min
        </p>
        <span
          className={`font-heading text-lg font-bold tabular-nums ${
            phase === "running" && remaining <= 0 ? "text-destructive" : ""
          }`}
        >
          {phase === "idle" ? fmt(timerSeconds) : fmt(remaining)}
        </span>
      </div>

      {phase === "idle" && (
        <>
          <p className="text-xs text-muted-foreground">
            Open the paper first, then press Start.
          </p>
          <Button type="button" size="sm" className="w-full" onClick={start}>
            <Play className="size-4" /> Start timer
          </Button>
        </>
      )}
      {phase === "running" && (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="w-full"
          onClick={stop}
        >
          <Square className="size-4" /> I&apos;m done — stop
        </Button>
      )}
      {phase === "stopped" && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">
            Time taken: <strong>{fmt(elapsed)}</strong>
          </p>
          {!restarted && (
            <Button type="button" size="sm" variant="outline" onClick={restart}>
              <RotateCcw className="size-4" /> Restart (once)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ProofUploader({
  taskId,
  timerSeconds,
}: {
  taskId: string;
  timerSeconds?: number | null;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [timeSpent, setTimeSpent] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    setUploading(true);
    try {
      for (const file of selected) {
        const uploaded = await uploadFile(file, "proof");
        setFiles((f) => [...f, uploaded]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    startTransition(async () => {
      const res = await submitProof({
        task_id: taskId,
        file_keys: files.map((f) => f.key),
        student_note: note.trim() || undefined,
        time_spent_seconds: timeSpent,
      });
      if (!res.ok) {
        toast.error(
          res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error
        );
        return;
      }
      toast.success("Proof sent to Sir for review! 🎉");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      {timerSeconds ? (
        <TaskTimerBox timerSeconds={timerSeconds} onElapsed={setTimeSpent} />
      ) : null}

      <div className="space-y-2">
        <Label>Upload proof of your work</Label>
        <p className="text-sm text-muted-foreground">
          Photos of your answers or a PDF — so Sir can check what you did.
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFiles}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="size-4" />
          {uploading ? "Uploading…" : "Choose photos / PDF"}
        </Button>
        {files.length > 0 && (
          <ul className="space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={f.key} className="flex items-center gap-2">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() => setFiles(files.filter((_, fi) => fi !== i))}
                  aria-label={`Remove ${f.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="proof-note">Note for Sir (optional)</Label>
        <Textarea
          id="proof-note"
          rows={2}
          placeholder="Anything you found hard?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Button className="w-full" disabled={pending || uploading} onClick={submit}>
        <Upload className="size-4" />
        {pending ? "Sending…" : "Send proof to Sir"}
      </Button>
    </div>
  );
}
