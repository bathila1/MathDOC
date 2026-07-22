"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, Eye, X } from "lucide-react";

export interface QuizAnswer {
  question: string;
  chosen: string | null;
  correct: string;
  isCorrect: boolean;
}

/** Score at a glance; the full answer sheet opens in a popup. */
export function QuizResultDialog({
  score,
  total,
  answers,
}: {
  score: number | null;
  total: number | null;
  answers: QuizAnswer[];
}) {
  const [open, setOpen] = useState(false);

  if (score == null || total == null) {
    return (
      <p className="text-sm text-muted-foreground">Quiz not attempted yet.</p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-heading text-3xl font-bold">
        {score}
        <span className="text-lg text-muted-foreground">/{total}</span>
      </span>
      <Badge variant="secondary">
        {Math.round((score / total) * 100)}% correct
      </Badge>
      {answers.length > 0 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              // data-slot must match what DialogTrigger stamps on the DOM,
              // otherwise server and client HTML disagree (hydration error).
              <Button data-slot="dialog-trigger" variant="outline" size="sm">
                <Eye className="size-4" /> Show answers
              </Button>
            }
          />
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Placement quiz — {score}/{total}
              </DialogTitle>
            </DialogHeader>
            <ol className="space-y-4">
              {answers.map((a, i) => (
                <li key={i} className="border-b pb-3 last:border-0">
                  <p className="text-sm font-medium">
                    {i + 1}. {a.question}
                  </p>
                  <p
                    className={`mt-1 flex items-start gap-1.5 text-sm ${
                      a.isCorrect ? "text-green-700" : "text-destructive"
                    }`}
                  >
                    {a.isCorrect ? (
                      <Check className="mt-0.5 size-4 shrink-0" />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0" />
                    )}
                    <span>{a.chosen ?? "No answer"}</span>
                  </p>
                  {!a.isCorrect && (
                    <p className="mt-0.5 pl-5.5 text-sm text-muted-foreground">
                      Correct answer: {a.correct}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
