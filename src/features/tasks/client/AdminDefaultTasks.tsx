"use client";

import { useState, useTransition } from "react";
import type { DefaultTask } from "@/lib/shared/types";
import {
  createDefaultTask,
  updateDefaultTask,
  deleteDefaultTask,
  moveDefaultTask,
} from "@/features/tasks/server/default-actions";
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
import {
  ArrowDown,
  ArrowUp,
  Handshake,
  Pencil,
  Plus,
  Star,
  Timer,
  Trash2,
} from "lucide-react";

interface EditorState {
  title: string;
  description: string;
  type: "task" | "meet_sir";
  is_priority: boolean;
  timer_minutes: number | null;
}

const empty: EditorState = {
  title: "",
  description: "",
  type: "task",
  is_priority: false,
  timer_minutes: null,
};

function TemplateEditor({
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
  const [pending, startTransition] = useTransition();

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
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={state.title}
              placeholder="e.g. Practice set: 10 questions"
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={state.description}
              onChange={(e) =>
                setState((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={state.is_priority}
              onCheckedChange={(v: boolean) =>
                setState((s) => ({ ...s, is_priority: Boolean(v) }))
              }
            />
            <span className="font-medium">Priority by default</span>
          </label>
          <div className="space-y-2">
            <Label>Default time limit in minutes (optional)</Label>
            <Input
              type="number"
              min={1}
              max={600}
              value={state.timer_minutes ?? ""}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  timer_minutes: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const saved = await onSave(state);
                if (saved) setOpen(false);
              })
            }
          >
            {pending ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminDefaultTasks({ templates }: { templates: DefaultTask[] }) {
  const [, startTransition] = useTransition();

  async function create(s: EditorState): Promise<boolean> {
    const res = await createDefaultTask(s);
    if (!res.ok) {
      toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
      return false;
    }
    toast.success("Template added.");
    return true;
  }

  async function edit(id: string, s: EditorState): Promise<boolean> {
    const res = await updateDefaultTask(id, s);
    if (!res.ok) {
      toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
      return false;
    }
    toast.success("Template updated.");
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Reusable tasks you can drop onto any student from the &ldquo;Add
          task&rdquo; box.
        </p>
        <TemplateEditor
          title="Add a template"
          initial={empty}
          onSave={create}
          trigger={
            <Button data-slot="dialog-trigger" size="sm">
              <Plus className="size-4" /> Add template
            </Button>
          }
        />
      </div>

      <div className="space-y-2">
        {templates.map((t, i) => (
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
                      await moveDefaultTask(t.id, "up");
                    })
                  }
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === templates.length - 1}
                  onClick={() =>
                    startTransition(async () => {
                      await moveDefaultTask(t.id, "down");
                    })
                  }
                >
                  <ArrowDown className="size-4" />
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
                  {t.type === "meet_sir" && (
                    <Badge variant="secondary">
                      <Handshake className="size-3" /> Meet with Sir
                    </Badge>
                  )}
                  {t.timer_seconds && (
                    <Badge variant="outline">
                      <Timer className="size-3" /> {Math.round(t.timer_seconds / 60)} min
                    </Badge>
                  )}
                </div>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <TemplateEditor
                  title="Edit template"
                  initial={{
                    title: t.title,
                    description: t.description,
                    type: t.type,
                    is_priority: t.is_priority,
                    timer_minutes: t.timer_seconds
                      ? Math.round(t.timer_seconds / 60)
                      : null,
                  }}
                  onSave={(s) => edit(t.id, s)}
                  trigger={
                    <Button data-slot="dialog-trigger" variant="ghost" size="icon">
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    startTransition(async () => {
                      if (!confirm("Delete this template?")) return;
                      const res = await deleteDefaultTask(t.id);
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Template deleted.");
                    })
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No templates yet — add your most common tasks here.
          </p>
        )}
      </div>
    </div>
  );
}
