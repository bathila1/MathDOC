"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitProof } from "@/features/tasks/server/actions";
import { uploadFile, type UploadedFile } from "@/lib/client/upload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, Send, Square, Timer, Trash2, Upload } from "lucide-react";

function fmt(sec: number): string {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${sec < 0 ? "-" : ""}${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

/** Countdown timer for a timed paper, styled like a digital clock. */
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
  const overtime = remaining < 0;
  const over = elapsed - timerSeconds; // seconds past the limit (>0 in overtime)
  // Once the limit passes we keep counting UP in "+mm:ss" instead of going
  // negative, so the student can see exactly how far over they are.
  const display =
    phase === "idle" ? fmt(timerSeconds) : overtime ? `+${fmt(over)}` : fmt(remaining);
  const digitColor =
    phase === "idle"
      ? "text-slate-100"
      : overtime
        ? "text-red-400"
        : phase === "running"
          ? "text-emerald-400"
          : "text-slate-100";

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-slate-900 p-4 text-center dark:bg-slate-950">
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
        <Timer className="size-3.5" /> Timed task · {Math.round(timerSeconds / 60)} min
      </p>
      <div
        className={cn(
          "my-3 font-mono text-5xl font-bold tracking-tight tabular-nums sm:text-6xl",
          digitColor,
          phase === "running" && "animate-pulse"
        )}
      >
        {display}
      </div>
      {phase === "idle" && (
        <>
          <Button size="lg" className="w-full" onClick={start}>
            <Play className="size-4" /> Start timer
          </Button>
          <p className="mt-2 text-xs text-slate-400">
            Open the paper first, then press Start.
          </p>
        </>
      )}
      {phase === "running" && (
        <>
          {overtime && (
            <p className="mb-2 text-xs font-semibold text-red-400">
              Over the time limit — that&apos;s okay, keep going. Sir will see how
              long you took.
            </p>
          )}
          <Button size="lg" variant="destructive" className="w-full" onClick={stop}>
            <Square className="size-4" /> I&apos;m done — stop
          </Button>
        </>
      )}
      {phase === "stopped" && (
        <div className="flex items-center justify-center gap-3">
          <p className="text-sm text-slate-200">
            Time taken: <strong>{fmt(elapsed).replace("-", "")}</strong>
            {over > 0 && (
              <span className="font-semibold text-red-400"> (+{fmt(over)} over)</span>
            )}
          </p>
          {!restarted && (
            <Button size="sm" variant="secondary" onClick={restart}>
              <RotateCcw className="size-4" /> Restart
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
    <div className="space-y-4">
      {timerSeconds ? (
        <TaskTimerBox timerSeconds={timerSeconds} onElapsed={setTimeSpent} />
      ) : null}

      {/* Big, obvious upload drop-zone */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFiles}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
      >
        <Upload className="size-8 text-primary" />
        <span className="text-base font-semibold">
          {uploading ? "Uploading…" : "Upload proof of your work"}
        </span>
        <span className="text-xs text-muted-foreground">
          Tap to add photos of your answers or a PDF
        </span>
      </button>

      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={f.key} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                className="ml-auto text-destructive"
                onClick={() => setFiles(files.filter((_, fi) => fi !== i))}
                aria-label={`Remove ${f.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="proof-note" className="text-xs text-muted-foreground">
          Note for Sir (optional)
        </Label>
        <Textarea
          id="proof-note"
          rows={2}
          placeholder="Anything you found hard?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" disabled={pending || uploading} onClick={submit}>
          <Send className="size-4" />
          {pending ? "Sending…" : "Send to Sir"}
        </Button>
      </div>
    </div>
  );
}
