"use client";

import { useState, useTransition } from "react";
import type { McqQuestion } from "@/lib/shared/types";
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  toggleQuestionActive,
  moveQuestion,
} from "@/features/exam/server/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

interface EditorState {
  text: string;
  options: string[];
  correct_index: number;
  is_active: boolean;
}

const emptyEditor: EditorState = {
  text: "",
  options: ["", "", "", ""],
  correct_index: 0,
  is_active: true,
};

function QuestionEditor({
  initial,
  title,
  onSave,
  open,
  setOpen,
  trigger,
}: {
  initial: EditorState;
  title: string;
  onSave: (state: EditorState) => Promise<void>;
  open: boolean;
  setOpen: (v: boolean) => void;
  trigger: React.ReactElement<Record<string, unknown>>;
}) {
  const [state, setState] = useState<EditorState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function setOption(i: number, value: string) {
    setState((s) => ({
      ...s,
      options: s.options.map((o, oi) => (oi === i ? value : o)),
    }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setState(initial);
          setErrors({});
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Question</Label>
            <Textarea
              rows={2}
              value={state.text}
              onChange={(e) => setState((s) => ({ ...s, text: e.target.value }))}
            />
            {errors.text && (
              <p className="text-sm text-destructive">{errors.text}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Answer options (tick the correct one)</Label>
            <RadioGroup
              value={state.correct_index.toString()}
              onValueChange={(v) =>
                setState((s) => ({ ...s, correct_index: Number(v) }))
              }
              className="space-y-2"
            >
              {state.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem value={i.toString()} id={`opt-${i}`} />
                  <Input
                    value={opt}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) => setOption(i, e.target.value)}
                  />
                  {state.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          options: s.options.filter((_, oi) => oi !== i),
                          correct_index:
                            s.correct_index >= i && s.correct_index > 0
                              ? s.correct_index - (s.correct_index === i ? s.correct_index : 1)
                              : s.correct_index,
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </RadioGroup>
            {state.options.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setState((s) => ({ ...s, options: [...s.options, ""] }))
                }
              >
                <Plus className="size-4" /> Add option
              </Button>
            )}
            {(errors.options || errors.correct_index) && (
              <p className="text-sm text-destructive">
                {errors.options ?? errors.correct_index}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setErrors({});
                try {
                  await onSave(state);
                  setOpen(false);
                } catch (e) {
                  if (e instanceof SaveError) setErrors(e.fieldErrors);
                }
              })
            }
          >
            {pending ? "Saving…" : "Save question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

class SaveError extends Error {
  constructor(public fieldErrors: Record<string, string>, message: string) {
    super(message);
  }
}

export function AdminQuestions({ questions }: { questions: McqQuestion[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleSave(
    state: EditorState,
    id?: string
  ): Promise<void> {
    const payload = {
      text: state.text,
      options: state.options,
      correct_index: state.correct_index,
      is_active: state.is_active,
    };
    const res = id
      ? await updateQuestion(id, payload)
      : await createQuestion(payload);
    if (!res.ok) {
      toast.error(res.error);
      throw new SaveError(res.fieldErrors ?? {}, res.error);
    }
    toast.success(id ? "Question updated." : "Question added.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {questions.length} question{questions.length === 1 ? "" : "s"} —
          students answer the active ones when they register.
        </p>
        <QuestionEditor
          initial={emptyEditor}
          title="Add a question"
          onSave={(s) => handleSave(s)}
          open={addOpen}
          setOpen={setAddOpen}
          trigger={
            <Button data-slot="dialog-trigger">
              <Plus className="size-4" /> Add question
            </Button>
          }
        />
      </div>

      <div className="space-y-2">
        {questions.map((q, i) => (
          <Card key={q.id} className={q.is_active ? "" : "opacity-60"}>
            <CardContent className="flex items-start gap-3 py-4">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === 0}
                  onClick={() =>
                    startTransition(async () => {
                      await moveQuestion(q.id, "up");
                    })
                  }
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === questions.length - 1}
                  onClick={() =>
                    startTransition(async () => {
                      await moveQuestion(q.id, "down");
                    })
                  }
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {i + 1}. {q.text}
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  {q.options.map((opt, oi) => (
                    <li key={oi}>
                      {oi === q.correct_index ? (
                        <Badge variant="secondary" className="mr-1">
                          ✓
                        </Badge>
                      ) : (
                        <span className="mr-3" />
                      )}
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await toggleQuestionActive(q.id, !q.is_active);
                      if (!res.ok) toast.error(res.error);
                    })
                  }
                >
                  {q.is_active ? "Deactivate" : "Activate"}
                </Button>
                <QuestionEditor
                  initial={{
                    text: q.text,
                    options: q.options,
                    correct_index: q.correct_index,
                    is_active: q.is_active,
                  }}
                  title="Edit question"
                  onSave={(s) => handleSave(s, q.id)}
                  open={editId === q.id}
                  setOpen={(v) => setEditId(v ? q.id : null)}
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
                      if (!confirm("Delete this question?")) return;
                      const res = await deleteQuestion(q.id);
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Question deleted.");
                    })
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {questions.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No questions yet — add the first one.
          </p>
        )}
      </div>
    </div>
  );
}
