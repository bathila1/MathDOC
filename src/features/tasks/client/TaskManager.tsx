"use client";

import { useRef, useState, useTransition } from "react";
import type { Task } from "@/lib/shared/types";
import {
  addTask,
  updateTask,
  deleteTask,
  moveTask,
  approveTask,
} from "@/features/tasks/server/actions";
import { uploadFile } from "@/lib/client/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Handshake,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

const statusLabels: Record<Task["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
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
}

function TaskEditor({
  title,
  initial,
  onSave,
  trigger,
}: {
  title: string;
  initial: EditorState;
  onSave: (s: EditorState) => Promise<boolean>;
  trigger: React.ReactElement<Record<string, unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, "task_attachment");
      setState((s) => ({ ...s, attachment_key: uploaded.key }));
      setFileName(uploaded.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setState(initial);
          setFileName(null);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
              A checkpoint — the student books a free follow-up meeting with you
              to discuss progress before continuing.
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
          {state.type === "task" && (
            <div className="space-y-2">
              <Label>Attachment (PDF or image, optional)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFile}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                  {uploading
                    ? "Uploading…"
                    : state.attachment_key
                      ? "Replace file"
                      : "Attach file"}
                </Button>
                {(fileName || state.attachment_key) && (
                  <span className="truncate text-sm text-muted-foreground">
                    {fileName ?? "1 file attached"}
                  </span>
                )}
              </div>
            </div>
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

export function TaskManager({
  appointmentId,
  tasks,
}: {
  appointmentId: string;
  tasks: Task[];
}) {
  const [, startTransition] = useTransition();

  async function create(state: EditorState): Promise<boolean> {
    const res = await addTask({ appointment_id: appointmentId, ...state });
    if (!res.ok) {
      toast.error(
        res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error
      );
      return false;
    }
    toast.success("Task added.");
    return true;
  }

  async function edit(taskId: string, state: EditorState): Promise<boolean> {
    const res = await updateTask({ task_id: taskId, ...state });
    if (!res.ok) {
      toast.error(
        res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error
      );
      return false;
    }
    toast.success("Task updated.");
    return true;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Tasks ({tasks.filter((t) => t.status === "approved").length}/
          {tasks.length} done)
        </h2>
        <TaskEditor
          title="Add a task"
          initial={{ type: "task", title: "", description: "", attachment_key: null }}
          onSave={create}
          trigger={
            <Button>
              <Plus className="size-4" /> Add task
            </Button>
          }
        />
      </div>

      {tasks.length === 0 && (
        <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          No tasks yet. After talking with the student, add the tasks they
          should complete one by one.
        </p>
      )}

      {tasks.map((t, i) => {
        const status = statusLabels[t.status];
        return (
          <Card key={t.id}>
            <CardContent className="flex items-start gap-3 py-4">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === 0}
                  onClick={() =>
                    startTransition(async () => {
                      await moveTask(t.id, "up");
                    })
                  }
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === tasks.length - 1}
                  onClick={() =>
                    startTransition(async () => {
                      await moveTask(t.id, "down");
                    })
                  }
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {i + 1}. {t.title}
                  </span>
                  {t.type === "meet_sir" && (
                    <Badge variant="outline">
                      <Handshake className="size-3" /> Meet with Sir
                    </Badge>
                  )}
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {t.attachment_key && (
                    <Paperclip className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                  {t.description}
                </p>
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
                  initial={{
                    type: t.type,
                    title: t.title,
                    description: t.description,
                    attachment_key: t.attachment_key,
                  }}
                  onSave={(s) => edit(t.id, s)}
                  trigger={
                    <Button variant="ghost" size="icon">
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
        );
      })}
    </div>
  );
}
