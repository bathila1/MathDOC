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
  Circle,
  FileText,
  Flag,
  Handshake,
  Hourglass,
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
 * task shown in a box right below it. Clicking an unlocked circle swaps
 * what the box shows.
 */
export function JourneyBoard({ tasks }: { tasks: BoardTask[] }) {
  const [selectedId, setSelectedId] = useState(() => defaultSelection(tasks));
  const selectedIndex = tasks.findIndex((t) => t.id === selectedId);
  const selected = selectedIndex >= 0 ? tasks[selectedIndex] : null;

  const total = tasks.length;
  const approved = tasks.filter((t) => t.status === "approved").length;
  // The first still-to-finish task is highlighted as the suggested next step.
  const currentId = tasks.find((t) => t.status !== "approved")?.id ?? "";
  const progress = total ? Math.round((approved / total) * 100) : 0;
  // The bar fills by completed tasks; the label sits at the end of the fill,
  // so the percentage always matches what the bar shows.
  const fillFraction = total ? approved / total : 0;

  return (
    <div className="space-y-4">
      {/* ---- the rail ---- */}
      <div className="pb-1">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">
            {progress}% complete
          </p>
          <p className="text-sm text-muted-foreground">
            {approved} of {total} tasks done
          </p>
        </div>
        <div
          className="relative mx-auto px-2 pt-2 pb-1"
          style={{ minWidth: `${Math.max(total * 56, 260)}px` }}
        >
          {/* track */}
          <div className="absolute top-[calc(0.5rem+1.375rem)] right-6 left-6 h-4 -translate-y-1/2 rounded-full bg-muted" />
          {/* filled track */}
          <div
            className="absolute top-[calc(0.5rem+1.375rem)] left-6 h-4 -translate-y-1/2 rounded-full bg-brand-gradient transition-all duration-700"
            style={{ width: `calc((100% - 3rem) * ${fillFraction})` }}
          />
          <ol className="relative flex items-start justify-between">
            {tasks.map((t) => {
              const reached = t.status === "approved";
              const submitted = t.status === "proof_submitted";
              // The suggested "next" task is the first one still to finish —
              // but nothing is locked, so every circle is tappable.
              const isCurrent = t.id === currentId && !reached && !submitted;
              const todo = !reached && !submitted && !isCurrent;
              const isSelected = t.id === selectedId;

              return (
                <li key={t.id}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className="flex w-14 justify-center outline-none"
                        />
                      }
                    >
                      <span className="relative flex size-11 items-center justify-center">
                        {isCurrent && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                        )}
                        <span
                          className={cn(
                            "relative z-10 flex size-11 items-center justify-center rounded-full border-4 border-background shadow-sm transition-transform hover:scale-105",
                            reached && "bg-brand-gradient text-white",
                            (isCurrent || submitted) &&
                              "bg-card text-primary ring-3 ring-primary",
                            todo && "bg-muted text-muted-foreground",
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
                            <Circle className="size-4" />
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
                              ? "Start here next"
                              : "To do — tap to open"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </div>
        {progress === 100 && (
          <p className="mt-2 text-center text-sm font-semibold text-primary">
            All tasks complete — you did it!
          </p>
        )}
      </div>

      {/* ---- the task box ---- */}
      {selected && (
        <div
          key={selected.id}
          className="animate-pop-in rounded-xl border-2 border-primary/40 bg-card p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-primary uppercase">
              Task {selectedIndex + 1} of {total}
            </span>
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
            {selected.status === "active" &&
              (selected.id === currentId ? (
                <Badge>Start here next</Badge>
              ) : (
                <Badge variant="outline">To do</Badge>
              ))}
          </div>

          <h3 className="mt-3 text-xl">{selected.title}</h3>
          {selected.description && (
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
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
                    . Carry on with your next task in the meantime.
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
