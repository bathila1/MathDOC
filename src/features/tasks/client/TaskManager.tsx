"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createSupabaseBrowser } from "@/lib/client/supabase";
import type { DefaultTask, ProofStatus, Task } from "@/lib/shared/types";
import {
  addTask,
  updateTask,
  deleteTask,
  moveTask,
  reorderTasks,
  approveTask,
} from "@/features/tasks/server/actions";
import { markTaskChatSeen } from "@/features/tasks/server/chat-actions";
import dynamic from "next/dynamic";
import { uploadFile } from "@/lib/client/upload";
import { VoiceRecorder } from "./VoiceRecorder";
import { LinkList, FileList } from "./MediaLists";
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

// Chat pulls in the Supabase realtime client — load it on demand (it only
// renders inside the chat dialog) so it isn't in the task page's initial JS.
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
  is_priority: boolean;
  requires_proof: boolean;
  timer_minutes: number | null;
  due_at: string | null; // datetime-local string
  // Every media field is a LIST — a task may carry several of each.
  youtube_urls: string[];
  facebook_urls: string[];
  video_keys: string[];
  voice_keys: string[];
  question_image_keys: string[];
  attachment_keys: string[];
  sir_note: string;
}

/** The media lists an editor holds, used to drive the generic list controls. */
type MediaListField =
  | "youtube_urls"
  | "facebook_urls"
  | "video_keys"
  | "voice_keys"
  | "question_image_keys"
  | "attachment_keys";


const emptyEditor: EditorState = {
  type: "task",
  title: "",
  description: "",
  is_priority: false,
  requires_proof: true,
  timer_minutes: null,
  due_at: null,
  youtube_urls: [],
  facebook_urls: [],
  video_keys: [],
  voice_keys: [],
  question_image_keys: [],
  attachment_keys: [],
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
    is_priority: t.is_priority,
    requires_proof: t.requires_proof !== false,
    timer_minutes: t.timer_seconds ? Math.round(t.timer_seconds / 60) : null,
    due_at: t.due_at ? isoToLocalInput(t.due_at) : null,
    youtube_urls: t.youtube_urls ?? [],
    facebook_urls: t.facebook_urls ?? [],
    video_keys: t.video_keys ?? [],
    voice_keys: t.voice_keys ?? [],
    question_image_keys: t.question_image_keys ?? [],
    attachment_keys: t.attachment_keys ?? [],
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

  /** Append to one of the media lists. */
  function addTo(field: MediaListField, value: string) {
    setState((s) =>
      s[field].includes(value) ? s : { ...s, [field]: [...s[field], value] }
    );
  }
  function removeAt(field: MediaListField, index: number) {
    setState((s) => ({
      ...s,
      [field]: s[field].filter((_, i) => i !== index),
    }));
  }

  /** Upload one or more files and append each resulting key to `field`. */
  async function onUploadMany(
    files: FileList | null,
    purpose: "task_attachment" | "task_media" | "question_image" | "voice_note",
    field: MediaListField
  ) {
    const picked = Array.from(files ?? []);
    if (picked.length === 0) return;
    setUploading(true);
    try {
      for (const file of picked) {
        const uploaded = await uploadFile(file, purpose);
        addTo(field, uploaded.key);
      }
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
      requires_proof: t.requires_proof !== false,
      timer_minutes: t.timer_seconds ? Math.round(t.timer_seconds / 60) : null,
      // Templates carry media too — bring it across.
      youtube_urls: t.youtube_urls ?? [],
      facebook_urls: t.facebook_urls ?? [],
      video_keys: t.video_keys ?? [],
      voice_keys: t.voice_keys ?? [],
      question_image_keys: t.question_image_keys ?? [],
      attachment_keys: t.attachment_keys ?? [],
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
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Needs proof uploaded</p>
                <p className="text-xs text-muted-foreground">
                  Off for tasks like &ldquo;revise today&apos;s topic&rdquo; —
                  the student just gets a &ldquo;Mark as done&rdquo; button.
                </p>
              </div>
              <Switch
                checked={state.requires_proof}
                onCheckedChange={(v) =>
                  setState((s) => ({ ...s, requires_proof: v }))
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

              {/* ---- Media — any number of each ---- */}
              <Section
                title="Media"
                hint="Add as many as you like of each — links, videos, voice notes."
              >
                <LinkList
                  icon={PlayCircle}
                  label="YouTube links"
                  placeholder="https://youtu.be/…"
                  values={state.youtube_urls}
                  onAdd={(v) => addTo("youtube_urls", v)}
                  onRemove={(i) => removeAt("youtube_urls", i)}
                />
                <LinkList
                  icon={MonitorPlay}
                  label="Facebook video links"
                  placeholder="https://facebook.com/…/videos/…"
                  values={state.facebook_urls}
                  onAdd={(v) => addTo("facebook_urls", v)}
                  onRemove={(i) => removeAt("facebook_urls", i)}
                />

                <FileList
                  icon={Video}
                  label="Uploaded videos"
                  accept="video/mp4,video/webm"
                  addLabel="Add a video (max 60 MB)"
                  uploading={uploading}
                  values={state.video_keys}
                  onPick={(files) => onUploadMany(files, "task_media", "video_keys")}
                  onRemove={(i) => removeAt("video_keys", i)}
                />

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Mic className="size-4" /> Voice notes
                  </Label>
                  {state.voice_keys.map((key, i) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                    >
                      <Mic className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">Voice note {i + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-7"
                        aria-label={`Remove voice note ${i + 1}`}
                        onClick={() => removeAt("voice_keys", i)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {/* Records one at a time; each recording is appended. */}
                  <VoiceRecorder
                    value={null}
                    onChange={(key) => {
                      if (key) addTo("voice_keys", key);
                    }}
                  />
                </div>
              </Section>

              <Separator />

              {/* ---- Question images + attachments ---- */}
              <Section title="Questions & attachments">
                <FileList
                  icon={ImageIcon}
                  label="Questions as images"
                  accept="image/jpeg,image/png,image/webp"
                  addLabel="Add image"
                  uploading={uploading}
                  values={state.question_image_keys}
                  onPick={(files) =>
                    onUploadMany(files, "question_image", "question_image_keys")
                  }
                  onRemove={(i) => removeAt("question_image_keys", i)}
                />
                <FileList
                  icon={Paperclip}
                  label="Attachments — papers, PDFs or images"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  addLabel="Attach file"
                  uploading={uploading}
                  values={state.attachment_keys}
                  onPick={(files) =>
                    onUploadMany(files, "task_attachment", "attachment_keys")
                  }
                  onRemove={(i) => removeAt("attachment_keys", i)}
                />
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
  // Show a count once there's more than one of a kind.
  const chip = (n: number, icon: typeof Video, label: string) => {
    if (n > 0) items.push({ icon, label: n > 1 ? `${label} ×${n}` : label });
  };
  chip((t.youtube_urls ?? []).length, PlayCircle, "YouTube");
  chip((t.facebook_urls ?? []).length, MonitorPlay, "Facebook");
  chip((t.video_keys ?? []).length, Video, "Video");
  chip((t.voice_keys ?? []).length, Mic, "Voice");
  chip((t.question_image_keys ?? []).length, ImageIcon, "Image Q");
  chip((t.attachment_keys ?? []).length, Paperclip, "Attachment");
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
  unseenChats,
  heading = "Task journey",
}: {
  appointmentId?: string;
  tasks: AdminTask[];
  defaultTasks?: DefaultTask[];
  currentUserId?: string;
  unseenChats?: string[];
  heading?: string;
}) {
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(tasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [chatTaskId, setChatTaskId] = useState<string | null>(null);
  // Unread student-message dots. Opening a chat clears it (optimistically here
  // and persisted via markTaskChatSeen).
  const [seenLocal, setSeenLocal] = useState<Set<string>>(new Set());
  // `unseenChats` is a page-load snapshot; messages arriving while Sir sits on
  // this page are picked up over Realtime below.
  const [liveUnseen, setLiveUnseen] = useState<Set<string>>(new Set());
  const unseenSet = new Set([...(unseenChats ?? []), ...liveUnseen]);

  const taskIdKey = items.map((t) => t.id).join(",");
  useEffect(() => {
    const ids = taskIdKey ? taskIdKey.split(",") : [];
    if (ids.length === 0) return;
    const supabase = createSupabaseBrowser();
    // Unique topic per mount, same reasoning as NotificationBell.
    const channel = supabase
      .channel(`task-chat-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_messages" },
        (payload) => {
          const m = payload.new as { task_id: string; sender_role: string };
          // Only a student's message raises a dot, and only for a task on screen.
          if (m.sender_role !== "student" || !ids.includes(m.task_id)) return;
          setLiveUnseen((prev) => new Set(prev).add(m.task_id));
          setSeenLocal((prev) => {
            if (!prev.has(m.task_id)) return prev;
            const next = new Set(prev);
            next.delete(m.task_id); // a new message re-raises a cleared dot
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskIdKey]);

  function openChat(taskId: string) {
    setChatTaskId(taskId);
    if (unseenSet.has(taskId) && !seenLocal.has(taskId)) {
      setSeenLocal((prev) => new Set(prev).add(taskId));
      setLiveUnseen((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      startTransition(async () => {
        await markTaskChatSeen(taskId);
      });
    }
  }

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
                        onClick={() => openChat(t.id)}
                      >
                        <MessageCircle className="size-4" />
                        {unseenSet.has(t.id) && !seenLocal.has(t.id) && (
                          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" />
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
