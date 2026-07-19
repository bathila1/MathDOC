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

export function ExamForm({
  questions,
}: {
  questions: ExamQuestionForStudent[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const unanswered = questions.length - Object.keys(answers).length;

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
            You scored {result.score} out of {result.total}. Sir will look at
            your result and place you in the right group.
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
          <CardContent>
            <RadioGroup
              value={answers[q.id]?.toString() ?? ""}
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
