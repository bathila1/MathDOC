"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProofUploader } from "./ProofUploader";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  FileText,
  Flag,
  Handshake,
  Hourglass,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import type { TaskStatus, TaskType } from "@/lib/shared/types";

export interface BoardTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;
  sessionNo: number;
  attachmentUrl: string | null;
  rejectionNote: string | null;
  followUpAt: string | null; // booked follow-up meeting time (meet_sir)
}

function defaultSelection(tasks: BoardTask[]): string {
  return (
    tasks.find((t) => t.status === "active")?.id ??
    tasks.find((t) => t.status === "proof_submitted")?.id ??
    tasks[tasks.length - 1]?.id ??
    ""
  );
}

/**
 * The game board from the sketch: a milestone rail on top, and the selected
 * task shown in a box right below it — no separate page. Clicking an
 * unlocked circle swaps what the box shows.
 */
export function JourneyBoard({ tasks }: { tasks: BoardTask[] }) {
  const [selectedId, setSelectedId] = useState(() => defaultSelection(tasks));
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const total = tasks.length;
  const approved = tasks.filter((t) => t.status === "approved").length;
  const progress = total ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ---- the rail ---- */}
      <div className="overflow-x-auto pb-1">
        <div
          className="relative mx-auto px-2 pt-7 pb-1"
          style={{ minWidth: `${Math.max(total * 64, 280)}px` }}
        >
          <div className="absolute top-[calc(1.75rem+1.25rem)] right-6 left-6 h-2 -translate-y-1/2 rounded-full bg-muted" />
          <div
            className="absolute top-[calc(1.75rem+1.25rem)] left-6 h-2 -translate-y-1/2 rounded-full bg-brand-gradient transition-all duration-700"
            style={{
              width:
                total > 1
                  ? `calc((100% - 3rem) * ${approved === 0 ? 0 : Math.min(approved, total - 1) / (total - 1)})`
                  : approved > 0
                    ? "calc(100% - 3rem)"
                    : "0px",
            }}
          />
          <ol className="relative flex items-start justify-between">
            {tasks.map((t, i) => {
              const pct = Math.round(((i + 1) / total) * 100);
              const isCurrent = t.status === "active";
              const submitted = t.status === "proof_submitted";
              const reached = t.status === "approved";
              const locked = t.status === "locked";
              const isSelected = t.id === selectedId;

              return (
                <li key={t.id}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => setSelectedId(t.id)}
                          className={cn(
                            "flex w-16 flex-col items-center gap-1 outline-none",
                            locked && "cursor-not-allowed"
                          )}
                        />
                      }
                    >
                      <span
                        className={cn(
                          "text-[11px] font-bold tabular-nums",
                          reached
                            ? "text-primary"
                            : isCurrent || submitted
                              ? "text-foreground"
                              : "text-muted-foreground/60"
                        )}
                      >
                        {pct}%
                      </span>
                      <span className="relative flex size-10 items-center justify-center">
                        {isCurrent && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                        )}
                        <span
                          className={cn(
                            "relative z-10 flex size-10 items-center justify-center rounded-full border-4 border-background shadow-sm transition-transform",
                            !locked && "hover:scale-105",
                            reached && "bg-brand-gradient text-white",
                            (isCurrent || submitted) &&
                              "bg-card text-primary ring-3 ring-primary",
                            locked && "bg-muted text-muted-foreground/70",
                            isSelected && "ring-3 ring-foreground/70"
                          )}
                        >
                          {reached ? (
                            <Check className="size-5" strokeWidth={3} />
                          ) : submitted ? (
                            <Hourglass className="size-4" />
                          ) : t.type === "meet_sir" ? (
                            <Handshake className="size-4" />
                          ) : isCurrent ? (
                            <Flag className="size-4" />
                          ) : (
                            <Lock className="size-4" />
                          )}
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56 text-center">
                      <p className="font-bold">{t.title}</p>
                      <p className="text-xs opacity-80">
                        Session {t.sessionNo} ·{" "}
                        {reached
                          ? "Done"
                          : submitted
                            ? "Sent — waiting for Sir's review"
                            : isCurrent
                              ? "Your current task"
                              : "Locked — finish the tasks before it"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {progress === 100
            ? "100% complete — you did it!"
            : `${progress}% of your journey complete`}
        </p>
      </div>

      {/* ---- the box (from the sketch) ---- */}
      {selected && (
        <div
          key={selected.id}
          className="animate-pop-in rounded-xl border-2 border-primary/40 bg-card p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Session {selected.sessionNo}</Badge>
            {selected.type === "meet_sir" && (
              <Badge variant="secondary">
                <Handshake className="size-3" /> Meet with Sir
              </Badge>
            )}
            {selected.status === "approved" && (
              <Badge variant="secondary">
                <CheckCircle2 className="size-3" /> Approved
              </Badge>
            )}
            {selected.status === "proof_submitted" && (
              <Badge variant="outline">
                <Hourglass className="size-3" /> Being checked
              </Badge>
            )}
            {selected.status === "active" && <Badge>Current task</Badge>}
          </div>

          <h3 className="mt-3 text-xl">{selected.title}</h3>
          {selected.description && (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {selected.description}
            </p>
          )}

          <div className="mt-4 space-y-4">
            {selected.attachmentUrl && (
              <Button
                variant="outline"
                render={
                  <a
                    href={selected.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <FileText className="size-4" /> Open the attached material
              </Button>
            )}

            {selected.rejectionNote && selected.status === "active" && (
              <Alert variant="destructive">
                <AlertTitle>Sir sent this back</AlertTitle>
                <AlertDescription>{selected.rejectionNote}</AlertDescription>
              </Alert>
            )}

            {selected.type === "task" && selected.status === "active" && (
              <ProofUploader taskId={selected.id} />
            )}

            {selected.status === "proof_submitted" && (
              <p className="rounded-lg bg-muted p-4 text-sm">
                Your proof is with Sir. The next task is already unlocked — keep
                going while he checks it.
              </p>
            )}

            {selected.type === "meet_sir" && selected.status !== "approved" && (
              <div className="space-y-3">
                {selected.followUpAt ? (
                  <p className="rounded-lg bg-muted p-4 text-sm">
                    Your meeting with Sir is booked for{" "}
                    <strong>
                      {format(new Date(selected.followUpAt), "EEEE d MMMM, h:mm a")}
                    </strong>
                    . He&apos;ll unlock the next step after you meet.
                  </p>
                ) : (
                  selected.status === "active" && (
                    <Button
                      className="w-full sm:w-auto"
                      render={
                        <Link href={`/student/book?follow_up_task=${selected.id}`} />
                      }
                    >
                      <Handshake className="size-4" /> Meet with Sir again
                    </Button>
                  )
                )}
              </div>
            )}

            {selected.status === "approved" && (
              <p className="rounded-lg bg-muted p-4 text-sm">
                Done and approved — great work. Pick your next circle on the
                track above.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
