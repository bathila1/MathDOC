"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SurveyQuestion } from "@/lib/shared/types";
import { submitSurvey } from "@/features/survey/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ClipboardList } from "lucide-react";

/**
 * The survey students answer before booking.
 *
 * Opens automatically and cannot be dismissed — booking is gated behind it, so
 * there is no "close" affordance and no escape/outside-click dismissal. When a
 * student has answered before, the fields arrive pre-filled with last time's
 * answers so they only edit what has actually changed.
 */
export function SurveyGate({
  questions,
  previous,
  answeredBefore,
  children,
}: {
  questions: SurveyQuestion[];
  /** question id → last answer, used to pre-fill. */
  previous: Record<string, string>;
  answeredBefore: boolean;
  /** The booking UI, revealed once the survey is done. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const q of questions) seed[q.id] = previous[q.id] ?? "";
    return seed;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Nothing to ask — don't stand between the student and the calendar.
  if (questions.length === 0) return <>{children}</>;

  function set(id: string, value: string) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setFieldErrors((e) => {
      if (!e[id]) return e;
      const next = { ...e };
      delete next[id];
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await submitSurvey({ answers });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <>
      {/*
        Controlled with no onOpenChange, so Escape cannot close it, plus
        disablePointerDismissal for clicks on the backdrop. Booking is gated on
        this dialog, so there is deliberately no way out of it except answering.
      */}
      <Dialog open={!done} disablePointerDismissal>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" />
              Before you book
            </DialogTitle>
            <DialogDescription>
              {answeredBefore
                ? "These are your last answers. Update anything that has changed, then continue."
                : "A few quick questions so Sir knows how you're studying."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
            {questions.map((q) => (
              <div key={q.id} className="space-y-2">
                <Label htmlFor={`q-${q.id}`}>
                  {q.text}
                  {!q.is_required && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  )}
                </Label>

                {q.kind === "choice" ? (
                  <RadioGroup
                    value={answers[q.id] ?? ""}
                    onValueChange={(v: string) => set(q.id, v)}
                    className="gap-2"
                  >
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        <RadioGroupItem value={opt} id={`q-${q.id}-${opt}`} />
                        {opt}
                      </label>
                    ))}
                  </RadioGroup>
                ) : q.kind === "number" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      id={`q-${q.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => set(q.id, e.target.value)}
                      className="max-w-40"
                    />
                    {q.unit && (
                      <span className="text-sm text-muted-foreground">
                        {q.unit}
                      </span>
                    )}
                  </div>
                ) : (
                  <Textarea
                    id={`q-${q.id}`}
                    rows={2}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => set(q.id, e.target.value)}
                  />
                )}

                {fieldErrors[q.id] && (
                  <p className="text-sm text-destructive">{fieldErrors[q.id]}</p>
                )}
              </div>
            ))}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Saving…" : "Save and continue to booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {children}
    </>
  );
}
