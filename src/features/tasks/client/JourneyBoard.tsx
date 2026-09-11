"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import dynamic from "next/dynamic";
import { ProofUploader } from "./ProofUploader";
import { TaskMedia } from "./TaskMedia";
import { flagTask } from "@/features/tasks/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  Flag,
  Handshake,
  Hourglass,
  Zap,
} from "lucide-react";
import { formatSchool as format } from "@/lib/shared/time";
import type {
  ProofStatus,
  StudentFlag,
  TaskStatus,
  TaskType,
} from "@/lib/shared/types";

export interface BoardSubmission {
  status: ProofStatus;
  note: string | null;
  timeSpentSeconds: number | null;
  submittedAt: string;
}

// Chat pulls in the Supabase realtime client — load it on demand so it isn't
// part of the dashboard's initial JS bundle.
const TaskChat = dynamic(
  () => import("./TaskChat").then((m) => m.TaskChat),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
        Loading chat…
      </div>
    ),
  }
);

export interface BoardTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;
  sessionNo: number;
  attachmentUrls: string[];
  rejectionNote: string | null;
  followUpAt: string | null; // booked follow-up meeting time (meet_sir)
  // Phase 2
  isPriority: boolean;
  /** false => submit with a button instead of uploading files. */
  requiresProof: boolean;
  timerSeconds: number | null;
  dueAt: string | null;
  // Any number of each media type may be attached (migration 018).
  youtubeUrls: string[];
  facebookUrls: string[];
  videoUrls: string[]; // presigned urls for uploaded videos
  voiceUrls: string[]; // presigned urls for voice notes
  questionImageUrls: string[];
  studentFlag: StudentFlag | null;
  submissions: BoardSubmission[];
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Student-friendly "time left" for a task's due date. */
function dueInfo(dueAt: string, now: number) {
  const diff = new Date(dueAt).getTime() - now;
  const expired = diff <= 0;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const label = expired
    ? "Time's up"
    : days >= 1
      ? `${days}d left`
      : hours >= 1
        ? `${hours}h left`
        : `${Math.max(mins, 1)}m left`;
  return { label, expired, soon: !expired && diff <= 24 * 3_600_000 };
}

const submissionMeta: Record<
  ProofStatus,
  { label: string; variant: "secondary" | "destructive" | "outline" }
> = {
  accepted: { label: "Accepted", variant: "secondary" },
  rejected: { label: "Sent back", variant: "destructive" },
  pending: { label: "Waiting for review", variant: "outline" },
};

/** A titled section inside the task box. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </section>
  );
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
export function JourneyBoard({
  tasks,
  currentUserId,
}: {
  tasks: BoardTask[];
  currentUserId: string;
}) {
  // Follow-up meetings aren't tasks. Before a meeting is booked it sits on the
  // rail as a node the student can tap to book; once booked it simply drops off
  // the board. Meetings never count toward the task totals/percentage.
  const railTasks = tasks.filter((t) => t.type === "task");
  const railItems = tasks.filter(
    (t) =>
      t.type === "task" ||
      (t.type === "meet_sir" && !t.followUpAt && t.status !== "approved")
  );

  const [selectedId, setSelectedId] = useState(() => defaultSelection(railItems));
  const selectedIndex = railItems.findIndex((t) => t.id === selectedId);
  const selected = selectedIndex >= 0 ? railItems[selectedIndex] : null;
  // Header label ("Task 3 of 8") counts real tasks only, not meetings.
  const taskNumber =
    selected && selected.type === "task"
      ? railTasks.findIndex((t) => t.id === selected.id) + 1
      : 0;

  // Re-render each minute so the "time left" countdowns stay current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const selectedExpired = selected?.dueAt
    ? new Date(selected.dueAt).getTime() < now
    : false;
  // Whether any to-do task carries a due date — used to reserve headroom above
  // the rail for the little countdown popups.
  const hasDuePopups = railItems.some(
    (t) => t.type === "task" && t.status === "active" && t.dueAt
  );
  const total = railTasks.length;
  const awaiting = railTasks.filter((t) => t.status === "proof_submitted").length;
  const approved = railTasks.filter((t) => t.status === "approved").length;
  // The first still-to-finish task is highlighted as the suggested next step.
  const currentId = railTasks.find((t) => t.status !== "approved")?.id ?? "";
  const progress = total ? Math.round((approved / total) * 100) : 0;
  // The bar fills by completed tasks; the label sits at the end of the fill,
  // so the percentage always matches what the bar shows.
  const fillFraction = total ? approved / total : 0;
  const hasMaterials = !!(
    selected &&
    (selected.youtubeUrls.length ||
      selected.facebookUrls.length ||
      selected.videoUrls.length ||
      selected.voiceUrls.length ||
      selected.questionImageUrls.length ||
      selected.attachmentUrls.length)
  );

  // Shared task/meeting header (badges + title + description).
  const headerNode = selected ? (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold tracking-wider text-primary uppercase">
          {selected.type === "meet_sir"
            ? "Meeting with Sir"
            : `Task ${taskNumber} of ${total}`}
        </span>
        <Badge variant="outline">Session {selected.sessionNo}</Badge>
        {selected.isPriority && selected.status !== "approved" && (
          <Badge variant="destructive">
            <Zap className="size-3 fill-current" /> Priority
          </Badge>
        )}
        {selected.dueAt && (
          <Badge variant={selectedExpired ? "destructive" : "outline"}>
            <CalendarClock className="size-3" />
            {selectedExpired
              ? "Time's up"
              : `Do this before ${format(new Date(selected.dueAt), "d MMM")}`}
          </Badge>
        )}
        {selected.type === "task" && selected.status === "approved" && (
          <Badge variant="secondary">
            <CheckCircle2 className="size-3" /> Approved
          </Badge>
        )}
        {selected.type === "task" && selected.status === "proof_submitted" && (
          <Badge variant="outline">
            <Hourglass className="size-3" /> Being checked
          </Badge>
        )}
        {selected.type === "task" &&
          selected.status === "active" &&
          (selected.id === currentId ? (
            <Badge>Start here next</Badge>
          ) : (
            <Badge variant="outline">To do</Badge>
          ))}
      </div>
      <h3 className="mt-2 text-2xl font-bold">
        {selected.title || (selected.type === "meet_sir" ? "Meet with Sir" : "")}
      </h3>
      {selected.description && (
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
          {selected.description}
        </p>
      )}
    </div>
  ) : null;

  const router = useRouter();
  const [flagPending, startFlag] = useTransition();
  function flag(taskId: string, value: StudentFlag | null) {
    startFlag(async () => {
      const res = await flagTask(taskId, value);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(value ? "Sir has been let know." : "Cleared.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* ---- the rail ---- */}
      {railItems.length > 0 && (
      <div className="pb-1">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{progress}% complete</p>
          <div className="flex items-center gap-2">
            {awaiting > 0 && (
              <Badge variant="outline" className="gap-1">
                <Hourglass className="size-3" /> {awaiting} awaiting review
              </Badge>
            )}
            <p className="text-sm text-muted-foreground">
              {approved} of {total} tasks done
            </p>
          </div>
        </div>
        <div
          className={cn(
            "relative px-1 pt-2 pb-1 sm:px-2",
            // Room above the bubbles for the countdown popups.
            hasDuePopups && "mt-7"
          )}
        >
          {/* track — vertically centred on the bubbles (smaller on mobile).
              Side insets are constant (1rem) so the fill width stays aligned. */}
          <div className="absolute top-[calc(0.5rem+0.875rem)] right-4 left-4 h-2.5 -translate-y-1/2 rounded-full bg-muted sm:top-[calc(0.5rem+1.375rem)] sm:h-4" />
          {/* filled track */}
          <div
            className="absolute top-[calc(0.5rem+0.875rem)] left-4 h-2.5 -translate-y-1/2 rounded-full bg-brand-gradient transition-all duration-700 sm:top-[calc(0.5rem+1.375rem)] sm:h-4"
            style={{ width: `calc((100% - 2rem) * ${fillFraction})` }}
          />
          <ol className="relative flex items-start justify-between">
            {railItems.map((t) => {
              const isMeet = t.type === "meet_sir";
              const reached = !isMeet && t.status === "approved";
              const submitted = !isMeet && t.status === "proof_submitted";
              // The suggested "next" task is the first one still to finish —
              // but nothing is locked, so every circle is tappable.
              const isCurrent = !isMeet && t.id === currentId && !reached && !submitted;
              const todo = !isMeet && !reached && !submitted && !isCurrent;
              const isSelected = t.id === selectedId;
              // Prioritised, still-to-do tasks glow red so they're spottable
              // straight from the rail.
              const priority = !isMeet && t.isPriority && !reached;
              // Countdown popup only for still-to-do tasks that have a due date.
              const due =
                !isMeet && t.status === "active" && t.dueAt
                  ? dueInfo(t.dueAt, now)
                  : null;

              return (
                <li key={t.id}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className="flex w-9 justify-center outline-none sm:w-14"
                        />
                      }
                    >
                      <span className="relative flex size-7 items-center justify-center sm:size-11">
                        {/* countdown popup — only on the open task, so popups
                            never collide on the rail */}
                        {due && isSelected && (
                          <span
                            className={cn(
                              "pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] leading-none font-bold whitespace-nowrap shadow-sm",
                              due.expired
                                ? "bg-destructive text-white"
                                : due.soon
                                  ? "bg-amber-500 text-white"
                                  : "bg-foreground text-background"
                            )}
                          >
                            {due.label}
                            <span
                              aria-hidden
                              className={cn(
                                "absolute top-full left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45",
                                due.expired
                                  ? "bg-destructive"
                                  : due.soon
                                    ? "bg-amber-500"
                                    : "bg-foreground"
                              )}
                            />
                          </span>
                        )}
                        {/* red neon glow = prioritised task */}
                        {priority && (
                          <span
                            aria-hidden
                            className="absolute -inset-1.5 rounded-full bg-destructive/70 blur-md motion-safe:animate-pulse"
                          />
                        )}
                        {isCurrent && !priority && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                        )}
                        <span
                          className={cn(
                            "relative z-10 flex size-7 items-center justify-center rounded-full border-[3px] border-background shadow-sm transition-transform hover:scale-105 sm:size-11 sm:border-4",
                            reached && "bg-brand-gradient text-white",
                            (isCurrent || submitted) &&
                              "bg-card text-primary ring-3 ring-primary",
                            todo && "bg-muted text-muted-foreground",
                            isMeet && "bg-secondary text-secondary-foreground ring-3 ring-primary/60",
                            priority && "ring-3 ring-destructive",
                            isSelected && "ring-3 ring-foreground/70"
                          )}
                        >
                          {isMeet ? (
                            <Handshake className="size-4" />
                          ) : reached ? (
                            <Check className="size-5" strokeWidth={3} />
                          ) : submitted ? (
                            <Hourglass className="size-4" />
                          ) : priority ? (
                            <Zap className="size-4 fill-current" />
                          ) : isCurrent ? (
                            <Flag className="size-4" />
                          ) : (
                            <Circle className="size-4" />
                          )}
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56 text-center">
                      <p className="font-bold">
                        {t.title || (isMeet ? "Meet with Sir" : "")}
                      </p>
                      <p className="text-xs opacity-80">
                        {isMeet ? (
                          "Meeting with Sir — tap to book a time"
                        ) : (
                          <>
                            Session {t.sessionNo} ·{" "}
                            {priority && !reached && !submitted ? "Priority · " : ""}
                            {reached
                              ? "Done"
                              : submitted
                                ? "Sent — waiting for Sir's review"
                                : isCurrent
                                  ? "Start here next"
                                  : "To do — tap to open"}
                          </>
                        )}
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
      )}

      {/* ---- the task panel: two separate boxes (question | actions) ---- */}
      {selected &&
        (selected.type === "meet_sir" ? (
          <div
            key={selected.id}
            className="animate-pop-in space-y-6 overflow-hidden rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 sm:p-8"
          >
            {headerNode}

            {/* Book the meeting, or a note if it's not their turn yet */}
            {selected.status === "active" ? (
              <Button
                className="w-full sm:w-auto"
                render={
                  <Link href={`/student/book?follow_up_task=${selected.id}`} />
                }
              >
                <Handshake className="size-4" /> Book a meet with Sir
              </Button>
            ) : (
              <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                This meeting opens up once you&apos;ve finished the tasks before
                it.
              </p>
            )}
          </div>
        ) : (
          <div
            key={selected.id}
            // items-start: without it the grid stretches the left box to match
            // the taller right column, leaving a large empty area under the
            // question. Each box should be only as tall as its own content.
            className="animate-pop-in grid items-start gap-4 lg:grid-cols-[3fr_2fr]"
          >
            {/* LEFT box — the question & its materials */}
            <div
              className={cn(
                "min-w-0 space-y-4 overflow-hidden rounded-3xl bg-card p-6 shadow-soft ring-1 sm:p-7",
                selected.isPriority ? "ring-destructive/25" : "ring-border/60"
              )}
            >
              {selected.isPriority && (
                <div className="flex items-center gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                  <Zap className="size-4 fill-current" /> Priority — best to start
                  with this one
                </div>
              )}

              {headerNode}

              {hasMaterials && (
                <Section title="The question">
                  <div className="space-y-3">
                    <TaskMedia
                      youtubeUrls={selected.youtubeUrls}
                      facebookUrls={selected.facebookUrls}
                      videoUrls={selected.videoUrls}
                      voiceUrls={selected.voiceUrls}
                      questionImageUrls={selected.questionImageUrls}
                    />
                    {selected.attachmentUrls.map((url, i) => (
                      <Button
                        key={url}
                        variant="outline"
                        render={
                          <a href={url} target="_blank" rel="noreferrer" />
                        }
                      >
                        <FileText className="size-4" />
                        {selected.attachmentUrls.length > 1
                          ? `Open material ${i + 1}`
                          : "Open the attached material"}
                      </Button>
                    ))}
                  </div>
                </Section>
              )}
            </div>

            {/* RIGHT box — stuck, then upload proof, then chat */}
            <div className="min-w-0 space-y-5 overflow-hidden rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 sm:p-7">
                  {/* Alerts */}
                  {selected.rejectionNote && selected.status === "active" && (
                    <Alert variant="destructive">
                      <AlertTitle>Sir sent this back</AlertTitle>
                      <AlertDescription>{selected.rejectionNote}</AlertDescription>
                    </Alert>
                  )}
                  {selectedExpired && selected.status !== "approved" && (
                    <Alert variant="destructive">
                      <AlertTitle>Time&apos;s up for this one</AlertTitle>
                      <AlertDescription>
                        The time to hand this in has passed — have a quick word
                        with Sir.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Stuck? */}
                  {selected.status !== "approved" && (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-sm font-medium">Stuck?</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={flagPending}
                        className={cn(
                          "border-amber-500/60 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400",
                          selected.studentFlag === "hard" &&
                            "border-amber-500 bg-amber-500 text-white hover:bg-amber-600 dark:text-white"
                        )}
                        onClick={() =>
                          flag(
                            selected.id,
                            selected.studentFlag === "hard" ? null : "hard"
                          )
                        }
                      >
                        This is hard
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={flagPending}
                        className={cn(
                          "border-red-500/60 text-red-600 hover:bg-red-500/10 dark:text-red-400",
                          selected.studentFlag === "cant_do" &&
                            "border-red-600 bg-red-600 text-white hover:bg-red-700 dark:text-white"
                        )}
                        onClick={() =>
                          flag(
                            selected.id,
                            selected.studentFlag === "cant_do" ? null : "cant_do"
                          )
                        }
                      >
                        I can&apos;t do this
                      </Button>
                      {selected.studentFlag && (
                        <span className="text-xs text-muted-foreground">
                          Sir has been told — tap again to undo.
                        </span>
                      )}
                    </div>
                  )}

                  {/* Upload proof */}
                  {selected.status === "active" && !selectedExpired && (
                    <Section
                      title={selected.requiresProof ? "Upload proof" : "Finish this task"}
                    >
                      <ProofUploader
                        taskId={selected.id}
                        timerSeconds={selected.timerSeconds}
                        requiresProof={selected.requiresProof}
                      />
                    </Section>
                  )}

                  {selected.status === "proof_submitted" && (
                    <p className="rounded-xl bg-muted p-4 text-sm">
                      Your proof is with Sir. The next task is already unlocked —
                      keep going while he checks it.
                    </p>
                  )}

                  {selected.status === "approved" && (
                    <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                      Done and approved — great work! Pick your next circle on the
                      track above.
                    </p>
                  )}

                  {/* Submissions */}
                  {selected.submissions.length > 0 && (
                    <Section title="Your submissions">
                      <div className="space-y-2">
                        {selected.submissions.map((s, i) => {
                          const meta = submissionMeta[s.status];
                          return (
                            <div key={i} className="rounded-xl bg-muted/40 p-4">
                              <div className="flex items-center justify-between gap-2">
                                <Badge variant={meta.variant}>{meta.label}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(s.submittedAt), "d MMM, h:mm a")}
                                </span>
                              </div>
                              {s.timeSpentSeconds != null && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Time taken: {fmtDuration(s.timeSpentSeconds)}
                                  {selected.timerSeconds != null &&
                                    s.timeSpentSeconds > selected.timerSeconds && (
                                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                                        {" "}
                                        · over the time limit
                                      </span>
                                    )}
                                </p>
                              )}
                              {s.note && (
                                <p className="mt-2 rounded bg-muted p-2 text-sm">
                                  <span className="font-medium">Sir:</span> {s.note}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Section>
                  )}

                  {/* Chat */}
                  <Section title="Questions about this task">
                    <TaskChat taskId={selected.id} currentUserId={currentUserId} />
                  </Section>
            </div>
          </div>
        ))}
    </div>
  );
}
