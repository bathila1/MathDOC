"use client";

import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Flag, Handshake, Lock, Hourglass } from "lucide-react";
import type { TaskStatus, TaskType } from "@/lib/shared/types";

export interface TrackTask {
  id: string;
  title: string;
  status: TaskStatus;
  type: TaskType;
  sessionNo: number;
}

/**
 * The game board from the sketch: a horizontal rail with one milestone
 * circle per task. Filled = approved, pulsing = current, grey = locked.
 * Hovering a circle shows the task name, session tag and % milestone.
 */
export function TaskTrack({ tasks }: { tasks: TrackTask[] }) {
  const total = tasks.length;
  const approved = tasks.filter((t) => t.status === "approved").length;
  const progress = total ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="relative mx-auto px-2 pt-7 pb-1"
        style={{ minWidth: `${Math.max(total * 64, 280)}px` }}
      >
        {/* rail */}
        <div className="absolute top-[calc(1.75rem+1.25rem)] right-6 left-6 h-2 -translate-y-1/2 rounded-full bg-muted" />
        {/* filled rail */}
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
            const isCurrent =
              t.status === "active" || t.status === "proof_submitted";
            const reached = t.status === "approved";
            const node = (
              <div className="flex w-16 flex-col items-center gap-1">
                <span
                  className={cn(
                    "text-[11px] font-bold tabular-nums",
                    reached
                      ? "text-primary"
                      : isCurrent
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
                      "relative z-10 flex size-10 items-center justify-center rounded-full border-4 border-background shadow-sm transition-transform hover:scale-105",
                      reached && "bg-brand-gradient text-white",
                      isCurrent && "bg-card text-primary ring-3 ring-primary",
                      !reached &&
                        !isCurrent &&
                        "bg-muted text-muted-foreground/70"
                    )}
                  >
                    {reached ? (
                      <Check className="size-5" strokeWidth={3} />
                    ) : t.status === "proof_submitted" ? (
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
              </div>
            );

            return (
              <li key={t.id} className="animate-pop-in" style={{ animationDelay: `${i * 60}ms` }}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      t.status === "locked" ? (
                        <span className="cursor-not-allowed">{node}</span>
                      ) : (
                        <Link href={`/student/tasks/${t.id}`}>{node}</Link>
                      )
                    }
                  />
                  <TooltipContent className="max-w-56 text-center">
                    <p className="font-bold">{t.title}</p>
                    <p className="text-xs opacity-80">
                      Session {t.sessionNo} ·{" "}
                      {t.status === "approved"
                        ? "Done"
                        : t.status === "proof_submitted"
                          ? "Waiting for Sir's review"
                          : t.status === "active"
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
  );
}
