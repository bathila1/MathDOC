"use client";

import { useState, useTransition } from "react";
import type { SurveyQuestion, SurveyQuestionKind } from "@/lib/shared/types";
import {
  createSurveyQuestion,
  updateSurveyQuestion,
  deleteSurveyQuestion,
  toggleSurveyQuestionActive,
  moveSurveyQuestion,
} from "@/features/survey/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";

interface EditorState {
  kind: SurveyQuestionKind;
  text: string;
  options: string[];
  unit: string;
  is_required: boolean;
  is_active: boolean;
}

const emptyEditor: EditorState = {
  kind: "text",
  text: "",
  options: ["", ""],
  unit: "",
  is_required: true,
  is_active: true,
};

const KIND_LABEL: Record<SurveyQuestionKind, string> = {
  text: "Written",
  choice: "Choose one",
  number: "Number",
};

function QuestionEditor({
  initial,
  onSave,
  trigger,
  title,
}: {
  initial: EditorState;
  onSave: (state: EditorState) => Promise<boolean>;
  trigger: React.ReactElement<Record<string, unknown>>;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<EditorState>(initial);
  const [pending, startTransition] = useTransition();

  function reset() {
    setS(initial);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v: boolean) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Answer type</Label>
            <Tabs
              value={s.kind}
              onValueChange={(v: string) =>
                setS({ ...s, kind: v as SurveyQuestionKind })
              }
            >
              <TabsList className="w-full">
                <TabsTrigger value="text">Written</TabsTrigger>
                <TabsTrigger value="choice">Choose one</TabsTrigger>
                <TabsTrigger value="number">Number</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {s.kind === "number"
                ? "Use this for anything you want to compare between sessions, like study hours — numbers can be tracked over time."
                : s.kind === "choice"
                  ? "The student picks one of your options."
                  : "The student types a free answer."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-text">Question</Label>
            <Textarea
              id="q-text"
              rows={2}
              placeholder="How many hours a week are you studying maths?"
              value={s.text}
              onChange={(e) => setS({ ...s, text: e.target.value })}
            />
          </div>

          {s.kind === "number" && (
            <div className="space-y-2">
              <Label htmlFor="q-unit">Unit (optional)</Label>
              <Input
                id="q-unit"
                placeholder="hours / week"
                value={s.unit}
                onChange={(e) => setS({ ...s, unit: e.target.value })}
                className="max-w-56"
              />
            </div>
          )}

          {s.kind === "choice" && (
            <div className="space-y-2">
              <Label>Answer options</Label>
              {s.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) => {
                      const next = [...s.options];
                      next[i] = e.target.value;
                      setS({ ...s, options: next });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove option ${i + 1}`}
                    disabled={s.options.length <= 2}
                    onClick={() =>
                      setS({
                        ...s,
                        options: s.options.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {s.options.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setS({ ...s, options: [...s.options, ""] })}
                >
                  <Plus className="size-4" /> Add option
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Required</p>
              <p className="text-xs text-muted-foreground">
                Students can&apos;t book without answering it.
              </p>
            </div>
            <Switch
              checked={s.is_required}
              onCheckedChange={(v: boolean) => setS({ ...s, is_required: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const okDone = await onSave(s);
                if (okDone) setOpen(false);
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

/** Strip blank option rows before sending — an empty option is never intended. */
function toPayload(s: EditorState) {
  return {
    kind: s.kind,
    text: s.text,
    options: s.kind === "choice" ? s.options.filter((o) => o.trim()) : [],
    unit: s.kind === "number" ? s.unit : null,
    is_required: s.is_required,
    is_active: s.is_active,
  };
}

export function AdminSurveyQuestions({
  questions,
}: {
  questions: SurveyQuestion[];
}) {
  const [, startTransition] = useTransition();

  async function save(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string
  ): Promise<boolean> {
    const res = await fn();
    if (!res.ok) {
      toast.error(res.error ?? "Something went wrong.");
      return false;
    }
    toast.success(successMessage);
    return true;
  }

  return (
    <div className="space-y-3">
      <QuestionEditor
        title="New survey question"
        initial={emptyEditor}
        onSave={(s) =>
          save(() => createSurveyQuestion(toPayload(s)), "Question added.")
        }
        trigger={
          <Button>
            <Plus className="size-4" /> Add question
          </Button>
        }
      />

      {questions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No survey questions yet. Students go straight to the calendar until
            you add one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <Card key={q.id} className={q.is_active ? "" : "opacity-60"}>
              <CardContent className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{KIND_LABEL[q.kind]}</Badge>
                    {q.is_required && <Badge variant="secondary">Required</Badge>}
                    {!q.is_active && <Badge variant="outline">Hidden</Badge>}
                  </div>
                  <p className="mt-1.5 font-medium">{q.text}</p>
                  {q.kind === "choice" && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {q.options.join(" · ")}
                    </p>
                  )}
                  {q.kind === "number" && q.unit && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      measured in {q.unit}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() =>
                      startTransition(() => {
                        void save(
                          () => moveSurveyQuestion(q.id, "up"),
                          "Moved."
                        );
                      })
                    }
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move down"
                    disabled={i === questions.length - 1}
                    onClick={() =>
                      startTransition(() => {
                        void save(
                          () => moveSurveyQuestion(q.id, "down"),
                          "Moved."
                        );
                      })
                    }
                  >
                    <ArrowDown className="size-4" />
                  </Button>

                  <QuestionEditor
                    title="Edit question"
                    initial={{
                      kind: q.kind,
                      text: q.text,
                      options:
                        q.options.length >= 2 ? [...q.options] : ["", ""],
                      unit: q.unit ?? "",
                      is_required: q.is_required,
                      is_active: q.is_active,
                    }}
                    onSave={(s) =>
                      save(
                        () => updateSurveyQuestion(q.id, toPayload(s)),
                        "Question saved."
                      )
                    }
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />

                  <Switch
                    checked={q.is_active}
                    aria-label="Show to students"
                    onCheckedChange={(v: boolean) =>
                      startTransition(() => {
                        void save(
                          () => toggleSurveyQuestionActive(q.id, v),
                          v ? "Question shown." : "Question hidden."
                        );
                      })
                    }
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() =>
                      startTransition(() => {
                        void save(
                          () => deleteSurveyQuestion(q.id),
                          "Question deleted."
                        );
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
