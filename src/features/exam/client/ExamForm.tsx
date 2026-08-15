"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitExam } from "@/features/exam/server/actions";
import type { ExamQuestionForStudent } from "@/features/exam/server/queries";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ExamForm({
  questions,
}: {
  questions: ExamQuestionForStudent[];
}) {
  const router = useRouter();
  // number = chosen option index (mcq); string = typed answer (text).
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const answered = questions.filter((q) => {
    const a = answers[q.id];
    return typeof a === "number" || (typeof a === "string" && a.trim() !== "");
  }).length;
  const unanswered = questions.length - answered;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitExam({ answers });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
    });
  }

  if (result) {
    return (
      <Card className="mx-auto w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>Quiz complete! 🎉</CardTitle>
          <CardDescription>
            {result.total > 0
              ? `You scored ${result.score} out of ${result.total}. `
              : "Your answers are in. "}
            Sir will look at your answers and place you in the right group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              router.push("/student");
              router.refresh();
            }}
          >
            Go to my dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-2xl space-y-4">
      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {i + 1}. {q.text}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {q.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={q.imageUrl}
                alt={`Question ${i + 1}`}
                className="max-h-[60vh] w-full rounded-lg border object-contain"
              />
            )}

            {q.kind === "text" ? (
              <Textarea
                rows={3}
                placeholder="Type your answer…"
                value={
                  typeof answers[q.id] === "string"
                    ? (answers[q.id] as string)
                    : ""
                }
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                }
              />
            ) : (
              <RadioGroup
                value={
                  typeof answers[q.id] === "number"
                    ? String(answers[q.id])
                    : ""
                }
                onValueChange={(v) =>
                  setAnswers((a) => ({ ...a, [q.id]: Number(v) }))
                }
              >
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <RadioGroupItem value={oi.toString()} id={`${q.id}-${oi}`} />
                    <Label htmlFor={`${q.id}-${oi}`} className="font-normal">
                      {opt}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending
          ? "Submitting…"
          : unanswered > 0
            ? `Submit (${unanswered} unanswered)`
            : "Submit my answers"}
      </Button>
    </form>
  );
}
