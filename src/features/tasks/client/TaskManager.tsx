"use client";

import { useRef, useState, useTransition } from "react";
import type { DefaultTask, ProofStatus, Task } from "@/lib/shared/types";
import {
  addTask,
  updateTask,
  deleteTask,
  moveTask,
  reorderTasks,
  approveTask,
} from "@/features/tasks/server/actions";
import { uploadFile } from "@/lib/client/upload";
import { VoiceRecorder } from "./VoiceRecorder";
import { TaskChat } from "./TaskChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Flag,
  GripVertical,
  Handshake,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Mic,
  MonitorPlay,
  Paperclip,
  Pencil,
  PlayCircle,
  Plus,
  Timer,
  Trash2,
  Video,
  Zap,
} from "lucide-react";

export interface AdminProof {
  id: string;
  status: ProofStatus;
  submittedAt: string;
  studentNote: string | null;
  timeSpentSeconds: number | null;
  files: { name: string; url: string }[];
}

/** Task plus its session tag (sessions are only a label, not the order). */
export type AdminTask = Task & {
  sessionNo: number;
  sir_note?: string;
  proofs?: AdminProof[];
};

const proofMeta: Record<
  ProofStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  pending: { label: "Awaiting review", variant: "default" },
  accepted: { label: "Accepted", variant: "secondary" },
  rejected: { label: "Sent back", variant: "destructive" },
};

function fmtSecs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

const statusLabels: Record<
  Task["status"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  locked: { label: "Locked", variant: "outline" },
  active: { label: "Active", variant: "default" },
  proof_submitted: { label: "Proof waiting", variant: "destructive" },
  approved: { label: "Approved", variant: "secondary" },
};

interface EditorState {
  type: "task" | "meet_sir";
  title: string;
  description: string;
  attachment_key: string | null;
  is_priority: boolean;
  timer_minutes: number | null;
  due_at: string | null; // datetime-local string
  youtube_url: string | null;
  facebook_url: string | null;
  video_key: string | null;
  voice_key: string | null;
  question_image_key: string | null;
  sir_note: string;
}

const emptyEditor: EditorState = {
  type: "task",
  title: "",
  description: "",
  attachment_key: null,
  is_priority: false,
  timer_minutes: null,
  due_at: null,
  youtube_url: null,
  facebook_url: null,
  video_key: null,
  voice_key: null,
  question_image_key: null,
  sir_note: "",
};

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function taskToEditor(t: AdminTask): EditorState {
  return {
    type: t.type,
    title: t.title,
    description: t.description,
    attachment_key: t.attachment_key,
    is_priority: t.is_priority,
    timer_minutes: t.timer_seconds ? Math.round(t.timer_seconds / 60) : null,
    due_at: t.due_at ? isoToLocalInput(t.due_at) : null,
    youtube_url: t.youtube_url,
    facebook_url: t.facebook_url,
    video_key: t.video_key,
    voice_key: t.voice_key,
    question_image_key: t.question_image_key,
    sir_note: t.sir_note ?? "",
  };
}

/** A titled block inside the editor with an uppercase label + optional hint. */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {title}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function TaskEditor({
  title,
  initial,
  templates,
  onSave,
  trigger,
}: {
  title: string;
  initial: EditorState;
  templates?: DefaultTask[]; // shown only in the Add dialog
  onSave: (s: EditorState) => Promise<boolean>;
  trigger: React.ReactElement<Record<string, unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const attachRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  async function onUpload(
    file: File | undefined,
    purpose: "task_attachment" | "task_media" | "question_image",
    apply: (key: string) => void
  ) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, purpose);
      apply(uploaded.key);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function applyTemplate(t: DefaultTask) {
    setState((s) => ({
      ...s,
      type: t.type,
      title: t.title,
      description: t.description,
      is_priority: t.is_priority,
      timer_minutes: t.timer_seconds ? Math.round(t.timer_seconds / 60) : null,
    }));
  }

  const isTask = state.type === "task";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setState(initial);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {templates && templates.length > 0 && (
            <div className="space-y-1.5 rounded-lg bg-muted/40 p-3">
              <Label>Start from a template (optional)</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) applyTemplate(t);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Pick a default task…
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.type === "meet_sir" ? "🤝 " : ""}
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ---- Basics ---- */}
          <Section title="Basics">
            <Tabs
              value={state.type}
              onValueChange={(v) =>
                setState((s) => ({ ...s, type: v as EditorState["type"] }))
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="task">Task</TabsTrigger>
                <TabsTrigger value="meet_sir">
                  <Handshake className="size-4" /> Meet with Sir
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {state.type === "meet_sir" && (
              <p className="text-sm text-muted-foreground">
                A checkpoint — the student books a free follow-up meeting with
                you. They can keep working on the next task meanwhile.
              </p>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={state.title}
                placeholder={
                  state.type === "meet_sir"
                    ? "Mid-plan progress check"
                    : "e.g. Practise 10 circle-theorem questions"
                }
                onChange={(e) =>
                  setState((s) => ({ ...s, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={state.description}
                placeholder="Explain exactly what the student should do…"
                onChange={(e) =>
                  setState((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>
          </Section>

          <Separator />

          {/* ---- Private note (teacher only) ---- */}
          <Section
            title="Private note"
            hint="Only you can see this — the student never does."
          >
            <div className="relative">
              <Lock className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Textarea
                rows={2}
                className="pl-8"
                value={state.sir_note}
                placeholder="Why you're giving this task to this student…"
                onChange={(e) =>
                  setState((s) => ({ ...s, sir_note: e.target.value }))
                }
              />
            </div>
          </Section>

          <Separator />

          {/* ---- Priority & scheduling ---- */}
          <Section title="Priority & scheduling">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Priority task</p>
                <p className="text-xs text-muted-foreground">
                  Highlighted in red for the student.
                </p>
              </div>
              <Switch
                checked={state.is_priority}
                onCheckedChange={(v) =>
                  setState((s) => ({ ...s, is_priority: v }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Expires on (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="datetime-local"
                  value={state.due_at ?? ""}
                  onChange={(e) =>
                    setState((s) => ({ ...s, due_at: e.target.value || null }))
                  }
                />
                {state.due_at && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setState((s) => ({ ...s, due_at: null }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </Section>

          {isTask && (
            <>
              <Separator />

              {/* ---- Timer ---- */}
              <Section title="Timer" hint="For a timed paper. The student starts and stops it; you get the time taken.">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Timer className="size-4 text-primary" /> Set a time limit
                  </p>
                  <Switch
                    checked={state.timer_minutes != null}
                    onCheckedChange={(v) =>
                      setState((s) => ({
                        ...s,
                        timer_minutes: v ? (s.timer_minutes ?? 60) : null,
                      }))
                    }
                  />
                </div>
                {state.timer_minutes != null && (
                  <div className="space-y-3 rounded-lg bg-primary/5 p-3">
                    <div className="flex flex-wrap gap-2">
                      {[15, 30, 45, 60, 90, 120].map((m) => (
                        <Button
                          key={m}
                          type="button"
                          size="sm"
                          variant={state.timer_minutes === m ? "default" : "outline"}
                          onClick={() =>
                            setState((s) => ({ ...s, timer_minutes: m }))
                          }
                        >
                          {m} min
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Custom:</span>
                      <Input
                        type="number"
                        min={1}
                        max={600}
                        className="w-24"
                        value={state.timer_minutes ?? ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            timer_minutes: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                  </div>
                )}
              </Section>

              <Separator />

              {/* ---- Media (any combination) ---- */}
              <Section
                title="Media"
                hint="Add any combination — a YouTube link, a Facebook link, an uploaded video and a voice note."
              >
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <PlayCircle className="size-4" /> YouTube link
                  </Label>
                  <Input
                    placeholder="https://youtu.be/…"
                    value={state.youtube_url ?? ""}
                    onChange={(e) =>
                      setState((s) => ({ ...s, youtube_url: e.target.value || null }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MonitorPlay className="size-4" /> Facebook video link
                  </Label>
                  <Input
                    placeholder="https://facebook.com/…/videos/…"
                    value={state.facebook_url ?? ""}
                    onChange={(e) =>
                      setState((s) => ({ ...s, facebook_url: e.target.value || null }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Video className="size-4" /> Upload a video
                  </Label>
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) =>
                      onUpload(e.target.files?.[0], "task_media", (key) =>
                        setState((s) => ({ ...s, video_key: key }))
                      )
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => videoRef.current?.click()}
                    >
                      <Video className="size-4" />
                      {uploading
                        ? "Uploading…"
                        : state.video_key
                          ? "Replace video"
                          : "Choose a video (max 60 MB)"}
                    </Button>
                    {state.video_key && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setState((s) => ({ ...s, video_key: null }))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Mic className="size-4" /> Voice note
                  </Label>
                  <VoiceRecorder
                    value={state.voice_key}
                    onChange={(key) => setState((s) => ({ ...s, voice_key: key }))}
                  />
                </div>
              </Section>

              <Separator />

              {/* ---- Question image + attachment ---- */}
              <Section title="Question & attachment">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <ImageIcon className="size-4" /> Question as an image
                  </Label>
                  <input
                    ref={imageRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) =>
                      onUpload(e.target.files?.[0], "question_image", (key) =>
                        setState((s) => ({ ...s, question_image_key: key }))
                      )
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => imageRef.current?.click()}
                    >
                      <ImageIcon className="size-4" />
                      {state.question_image_key ? "Replace image" : "Upload image"}
                    </Button>
                    {state.question_image_key && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setState((s) => ({ ...s, question_image_key: null }))
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Paperclip className="size-4" /> Attachment — paper, PDF or image
                  </Label>
                  <input
                    ref={attachRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) =>
                      onUpload(e.target.files?.[0], "task_attachment", (key) =>
                        setState((s) => ({ ...s, attachment_key: key }))
                      )
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => attachRef.current?.click()}
                    >
                      <Paperclip className="size-4" />
                      {state.attachment_key ? "Replace file" : "Attach file"}
                    </Button>
                    {state.attachment_key && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setState((s) => ({ ...s, attachment_key: null }))
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </Section>
            </>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            disabled={pending || uploading}
            onClick={() =>
              startTransition(async () => {
                const saved = await onSave(state);
                if (saved) setOpen(false);
              })
            }
          >
            {pending ? "Saving…" : "Save task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Compact media chips summarising what's attached to a task. */
function MediaChips({ t }: { t: Task }) {
  const items: { icon: typeof Video; label: string }[] = [];
  if (t.youtube_url) items.push({ icon: PlayCircle, label: "YouTube" });
  if (t.facebook_url) items.push({ icon: MonitorPlay, label: "Facebook" });
  if (t.video_key) items.push({ icon: Video, label: "Video" });
  if (t.voice_key) items.push({ icon: Mic, label: "Voice" });
  if (t.question_image_key) items.push({ icon: ImageIcon, label: "Image Q" });
  if (t.attachment_key) items.push({ icon: Paperclip, label: "Attachment" });
  return (
    <>
      {items.map((m) => (
        <span key={m.label} className="inline-flex items-center gap-1">
          <m.icon className="size-3.5" /> {m.label}
        </span>
      ))}
    </>
  );
}

/**
 * The student's whole journey as one editable, drag-sortable list.
 * Sessions are shown as a tag on each card, not as separate groups.
 * `appointmentId` (when given) is where newly added tasks go.
 */
export function TaskManager({
  appointmentId,
  tasks,
  defaultTasks,
  currentUserId,
  chatCounts,
  heading = "Task journey",
}: {
  appointmentId?: string;
  tasks: AdminTask[];
  defaultTasks?: DefaultTask[];
  currentUserId?: string;
  chatCounts?: Record<string, number>;
  heading?: string;
}) {
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(tasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [chatTaskId, setChatTaskId] = useState<string | null>(null);

  const [syncedTasks, setSyncedTasks] = useState(tasks);
  if (syncedTasks !== tasks) {
    setSyncedTasks(tasks);
    setItems(tasks);
  }

  async function create(state: EditorState): Promise<boolean> {
    if (!appointmentId) return false;
    const res = await addTask({ appointment_id: appointmentId, ...state });
    if (!res.ok) {
      toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
      return false;
    }
    toast.success("Task added.");
    return true;
  }

  async function edit(taskId: string, state: EditorState): Promise<boolean> {
    const res = await updateTask({ task_id: taskId, ...state });
    if (!res.ok) {
      toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
      return false;
    }
    toast.success("Task updated.");
    return true;
  }

  function commitOrder(next: AdminTask[]) {
    setItems(next);
    startTransition(async () => {
      const res = await reorderTasks(next.map((t) => t.id));
      if (!res.ok) {
        toast.error(res.error);
        setItems(tasks);
      }
    });
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((t) => t.id === dragId);
    const to = items.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commitOrder(next);
  }

  const done = items.filter((t) => t.status === "approved").length;
  const now = new Date().getTime();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg">{heading}</h2>
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "No tasks yet."
              : `${done} of ${items.length} approved · drag the handle to reorder`}
          </p>
        </div>
        {appointmentId && (
          <TaskEditor
            title="Add a task"
            initial={emptyEditor}
            templates={defaultTasks}
            onSave={create}
            trigger={
              <Button data-slot="dialog-trigger">
                <Plus className="size-4" /> Add task
              </Button>
            }
          />
        )}
      </div>

      {items.length === 0 && (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          {appointmentId
            ? "After talking with the student, add the tasks they should complete one by one."
            : "No tasks yet. Open one of their sessions to add tasks."}
        </p>
      )}

      <ol className="space-y-2">
        {items.map((t, i) => {
          const status = statusLabels[t.status];
          const isDragging = dragId === t.id;
          const isOver = overId === t.id && dragId !== t.id;
          const expired = t.due_at ? new Date(t.due_at).getTime() < now : false;
          return (
            <li
              key={t.id}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(t.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(t.id);
                setDragId(null);
                setOverId(null);
              }}
              className={cn(
                "transition-opacity",
                isDragging && "opacity-40",
                isOver && "ring-2 ring-primary ring-offset-2 rounded-xl"
              )}
            >
              <Card
                className={cn(
                  t.is_priority && "border-2 border-destructive bg-destructive/5"
                )}
              >
                <CardContent className="flex items-start gap-3 py-4">
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <GripVertical className="size-4 cursor-grab text-muted-foreground active:cursor-grabbing" />
                    <span className="text-xs font-bold text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={i === 0}
                      onClick={() =>
                        startTransition(async () => {
                          await moveTask(t.id, "up");
                        })
                      }
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={i === items.length - 1}
                      onClick={() =>
                        startTransition(async () => {
                          await moveTask(t.id, "down");
                        })
                      }
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.title}</span>
                      {t.is_priority && (
                        <Badge variant="destructive" className="gap-1 font-bold uppercase">
                          <Zap className="size-3 fill-current" /> Priority
                        </Badge>
                      )}
                      <Badge variant="outline">Session {t.sessionNo}</Badge>
                      {t.type === "meet_sir" && (
                        <Badge variant="secondary">
                          <Handshake className="size-3" /> Meet with Sir
                        </Badge>
                      )}
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {t.student_flag && (
                        <Badge className="border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-950/40">
                          <Flag className="size-3" />
                          Student: {t.student_flag === "hard" ? "Hard" : "Can't do"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
                      {t.description}
                    </p>
                    {t.sir_note && (
                      <p className="mt-1 flex items-start gap-1 text-xs italic text-muted-foreground">
                        <Lock className="mt-0.5 size-3 shrink-0" /> {t.sir_note}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {t.timer_seconds && (
                        <span className="inline-flex items-center gap-1">
                          <Timer className="size-3.5" />
                          {Math.round(t.timer_seconds / 60)} min
                        </span>
                      )}
                      {t.due_at && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            expired && "font-semibold text-destructive"
                          )}
                        >
                          <CalendarClock className="size-3.5" />
                          {expired ? "Expired" : "Due"}{" "}
                          {new Date(t.due_at).toLocaleDateString()}
                        </span>
                      )}
                      <MediaChips t={t} />
                    </div>

                    {/* Submitted proof, linked right under the task */}
                    {t.proofs && t.proofs.length > 0 && (
                      <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                          Submitted proof
                        </p>
                        {t.proofs.map((p) => {
                          const meta = proofMeta[p.status];
                          return (
                            <div key={p.id} className="text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={meta.variant}>{meta.label}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(p.submittedAt).toLocaleString()}
                                </span>
                                {p.timeSpentSeconds != null && (
                                  <span className="text-xs text-muted-foreground">
                                    · {fmtSecs(p.timeSpentSeconds)}
                                  </span>
                                )}
                              </div>
                              {p.studentNote && (
                                <p className="mt-1 text-sm italic">
                                  &ldquo;{p.studentNote}&rdquo;
                                </p>
                              )}
                              {p.files.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {p.files.map((f, fi) => (
                                    <Button
                                      key={fi}
                                      variant="outline"
                                      size="sm"
                                      render={
                                        <a
                                          href={f.url}
                                          target="_blank"
                                          rel="noreferrer"
                                        />
                                      }
                                    >
                                      <ExternalLink className="size-3.5" /> {f.name}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative"
                        aria-label="Open chat"
                        onClick={() => setChatTaskId(t.id)}
                      >
                        <MessageCircle className="size-4" />
                        {(chatCounts?.[t.id] ?? 0) > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                            {chatCounts?.[t.id]}
                          </span>
                        )}
                      </Button>
                    )}
                    {(t.status === "active" || t.status === "proof_submitted") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          startTransition(async () => {
                            const res = await approveTask(t.id);
                            if (!res.ok) toast.error(res.error);
                            else toast.success("Task approved.");
                          })
                        }
                      >
                        <CheckCircle2 className="size-4" /> Approve
                      </Button>
                    )}
                    {t.status === "proof_submitted" || t.status === "approved" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        title="Locked — the student has already submitted proof"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    ) : (
                      <TaskEditor
                        title="Edit task"
                        initial={taskToEditor(t)}
                        onSave={(s) => edit(t.id, s)}
                        trigger={
                          <Button
                            data-slot="dialog-trigger"
                            variant="ghost"
                            size="icon"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        startTransition(async () => {
                          if (!confirm("Delete this task?")) return;
                          const res = await deleteTask(t.id);
                          if (!res.ok) toast.error(res.error);
                        })
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <Dialog
        open={!!chatTaskId}
        onOpenChange={(v) => !v && setChatTaskId(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Task chat</DialogTitle>
          </DialogHeader>
          {chatTaskId && currentUserId && (
            <TaskChat taskId={chatTaskId} currentUserId={currentUserId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
