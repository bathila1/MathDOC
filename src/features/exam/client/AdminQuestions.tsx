"use client";

import { useRef, useState, useTransition } from "react";
import { uploadFile } from "@/lib/client/upload";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface EditorState {
  kind: "mcq" | "text";
  text: string;
  image_key: string | null;
  options: string[];
  correct_index: number;
  is_active: boolean;
}

const emptyEditor: EditorState = {
  kind: "mcq",
  text: "",
  image_key: null,
  options: ["", "", "", ""],
  correct_index: 0,
  is_active: true,
};

function QuestionEditor({
  initial,
  initialImageUrl = null,
  title,
  onSave,
  open,
  setOpen,
  trigger,
}: {
  initial: EditorState;
  initialImageUrl?: string | null;
  title: string;
  onSave: (state: EditorState) => Promise<void>;
  open: boolean;
  setOpen: (v: boolean) => void;
  trigger: React.ReactElement<Record<string, unknown>>;
}) {
  const [state, setState] = useState<EditorState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file, "question_image");
      setState((s) => ({ ...s, image_key: up.key }));
      setImageUrl(URL.createObjectURL(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

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
          <Tabs
            value={state.kind}
            onValueChange={(v) =>
              setState((s) => ({ ...s, kind: v as EditorState["kind"] }))
            }
          >
            <TabsList className="w-full">
              <TabsTrigger value="mcq" className="flex-1">
                Multiple choice
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                Written answer
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {state.kind === "text" && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Written answers aren&apos;t auto-marked — they don&apos;t count
              towards the score. You read them on the student&apos;s page.
            </p>
          )}

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
            <Label>Picture (optional)</Label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Question"
                    className="size-20 rounded-md border object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove picture"
                    className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white"
                    onClick={() => {
                      setState((s) => ({ ...s, image_key: null }));
                      setImageUrl(null);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPickImage}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                {uploading ? "Uploading…" : imageUrl ? "Replace" : "Add picture"}
              </Button>
            </div>
          </div>

          {state.kind === "mcq" && (
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
          )}
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

export function AdminQuestions({
  questions,
  imageUrls,
}: {
  questions: McqQuestion[];
  /** question id -> presigned URL for its picture. */
  imageUrls?: Record<string, string>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleSave(
    state: EditorState,
    id?: string
  ): Promise<void> {
    const payload = {
      kind: state.kind,
      text: state.text,
      image_key: state.image_key,
      // A written-answer question has no options and nothing to mark correct.
      options: state.kind === "text" ? [] : state.options,
      correct_index: state.kind === "text" ? null : state.correct_index,
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
                    kind: q.kind ?? "mcq",
                    text: q.text,
                    image_key: q.image_key ?? null,
                    options: q.options?.length ? q.options : ["", "", "", ""],
                    correct_index: q.correct_index ?? 0,
                    is_active: q.is_active,
                  }}
                  initialImageUrl={imageUrls?.[q.id] ?? null}
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
