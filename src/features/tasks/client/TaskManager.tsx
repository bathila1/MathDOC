"use client";

import { useRef, useState, useTransition } from "react";
import type { DefaultTask, MediaType, Task } from "@/lib/shared/types";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  GripVertical,
  Handshake,
  Image as ImageIcon,
  Mic,
  MonitorPlay,
  Paperclip,
  Pencil,
  PlayCircle,
  Plus,
  Star,
  Timer,
  Trash2,
  Video,
} from "lucide-react";

/** Task plus its session tag (sessions are only a label, not the order). */
export type AdminTask = Task & { sessionNo: number };

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
  media_type: MediaType | null;
  media_url: string | null;
  media_key: string | null;
  question_image_key: string | null;
}

const emptyEditor: EditorState = {
  type: "task",
  title: "",
  description: "",
  attachment_key: null,
  is_priority: false,
  timer_minutes: null,
  due_at: null,
  media_type: null,
  media_url: null,
  media_key: null,
  question_image_key: null,
};

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function taskToEditor(t: Task): EditorState {
  return {
    type: t.type,
    title: t.title,
    description: t.description,
    attachment_key: t.attachment_key,
    is_priority: t.is_priority,
    timer_minutes: t.timer_seconds ? Math.round(t.timer_seconds / 60) : null,
    due_at: t.due_at ? isoToLocalInput(t.due_at) : null,
    media_type: t.media_type,
    media_url: t.media_url,
    media_key: t.media_key,
    question_image_key: t.question_image_key,
  };
}

const mediaOptions: { value: MediaType | null; label: string; icon: typeof Video }[] = [
  { value: null, label: "None", icon: Paperclip },
  { value: "youtube", label: "YouTube", icon: PlayCircle },
  { value: "facebook", label: "Facebook", icon: MonitorPlay },
  { value: "video", label: "Upload", icon: Video },
  { value: "voice", label: "Voice", icon: Mic },
];

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {templates && templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>Start from a template (optional)</Label>
              <select
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
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
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={state.description}
              placeholder="Explain exactly what the student should do…"
              onChange={(e) =>
                setState((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>

          {/* Priority + expiry apply to any task type */}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={state.is_priority}
              onCheckedChange={(v: boolean) =>
                setState((s) => ({ ...s, is_priority: Boolean(v) }))
              }
            />
            <span className="font-medium">
              Mark as priority{" "}
              <span className="text-muted-foreground">(shown in red)</span>
            </span>
          </label>

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

          {isTask && (
            <>
              {/* Timer for a timed paper */}
              <div className="space-y-2">
                <Label>Time limit in minutes (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  max={600}
                  placeholder="e.g. 60 for a timed paper"
                  value={state.timer_minutes ?? ""}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      timer_minutes: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The student starts a timer, does the paper, and stops it — you
                  get the time taken with their answers.
                </p>
              </div>

              {/* Media */}
              <div className="space-y-2">
                <Label>Add a video or voice note (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {mediaOptions.map((opt) => {
                    const active = state.media_type === opt.value;
                    return (
                      <Button
                        key={opt.label}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            media_type: opt.value,
                            media_url: null,
                            media_key: null,
                          }))
                        }
                      >
                        <opt.icon className="size-4" /> {opt.label}
                      </Button>
                    );
                  })}
                </div>

                {(state.media_type === "youtube" ||
                  state.media_type === "facebook") && (
                  <Input
                    placeholder={
                      state.media_type === "youtube"
                        ? "Paste the YouTube link"
                        : "Paste the Facebook video link"
                    }
                    value={state.media_url ?? ""}
                    onChange={(e) =>
                      setState((s) => ({ ...s, media_url: e.target.value || null }))
                    }
                  />
                )}

                {state.media_type === "video" && (
                  <div>
                    <input
                      ref={videoRef}
                      type="file"
                      accept="video/mp4,video/webm"
                      className="hidden"
                      onChange={(e) =>
                        onUpload(e.target.files?.[0], "task_media", (key) =>
                          setState((s) => ({ ...s, media_key: key }))
                        )
                      }
                    />
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
                        : state.media_key
                          ? "Replace video"
                          : "Upload a video (max 60 MB)"}
                    </Button>
                    {state.media_key && (
                      <span className="ml-2 text-sm text-green-600">Video added ✓</span>
                    )}
                  </div>
                )}

                {state.media_type === "voice" && (
                  <VoiceRecorder
                    value={state.media_key}
                    onChange={(key) =>
                      setState((s) => ({ ...s, media_key: key }))
                    }
                  />
                )}
              </div>

              {/* Image-as-question */}
              <div className="space-y-2">
                <Label>Question as an image (optional)</Label>
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
                    {state.question_image_key ? "Replace image" : "Upload question image"}
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

              {/* Attachment (paper / PDF) */}
              <div className="space-y-2">
                <Label>Attachment — paper, PDF or image (optional)</Label>
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
                    <span className="text-sm text-green-600">File attached ✓</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
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

/** Small icon summarising a task's media kind. */
function mediaIcon(t: Task) {
  if (t.media_type === "youtube") return <PlayCircle className="size-3.5 text-muted-foreground" />;
  if (t.media_type === "facebook") return <MonitorPlay className="size-3.5 text-muted-foreground" />;
  if (t.media_type === "video") return <Video className="size-3.5 text-muted-foreground" />;
  if (t.media_type === "voice") return <Mic className="size-3.5 text-muted-foreground" />;
  return null;
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
  heading = "Task journey",
}: {
  appointmentId?: string;
  tasks: AdminTask[];
  defaultTasks?: DefaultTask[];
  heading?: string;
}) {
  const [, startTransition] = useTransition();
  // Local copy so drag reordering feels instant.
  const [items, setItems] = useState(tasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Re-sync when the server sends a fresh list (React's adjust-during-render
  // pattern — no effect needed).
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
        setItems(tasks); // put it back
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
              <Card className={cn(t.is_priority && "border-destructive/50")}>
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
                        <Badge variant="destructive">
                          <Star className="size-3" /> Priority
                        </Badge>
                      )}
                      <Badge variant="outline">Session {t.sessionNo}</Badge>
                      {t.type === "meet_sir" && (
                        <Badge variant="secondary">
                          <Handshake className="size-3" /> Meet with Sir
                        </Badge>
                      )}
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
                      {t.description}
                    </p>
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
                      {t.question_image_key && (
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="size-3.5" /> Image question
                        </span>
                      )}
                      {mediaIcon(t) && (
                        <span className="inline-flex items-center gap-1">
                          {mediaIcon(t)} {t.media_type}
                        </span>
                      )}
                      {t.attachment_key && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="size-3.5" /> Attachment
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
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
    </div>
  );
}
