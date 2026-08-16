"use client";

import { format } from "date-fns";
import type { SurveyQuestion, SurveyResponse } from "@/lib/shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

/**
 * A student's survey answers over time, newest first.
 *
 * The survey is re-asked before every booking precisely so the change can be
 * seen, so numeric answers carry a delta against the previous submission —
 * "6 hours (+2)" is the thing Sir actually wants to know.
 */
export function SurveyHistory({
  questions,
  responses,
}: {
  /** All questions, including retired ones, so old answers still have labels. */
  questions: SurveyQuestion[];
  /** Newest first. */
  responses: SurveyResponse[];
}) {
  if (responses.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No survey answers yet — the student fills this in when they book.
        </CardContent>
      </Card>
    );
  }

  const byId = new Map(questions.map((q) => [q.id, q]));

  return (
    <div className="space-y-3">
      {responses.map((r, i) => {
        // The submission before this one (responses are newest-first).
        const prev = responses[i + 1];

        // Keep Sir's question order, then any answers whose question is gone.
        const answeredIds = Object.keys(r.answers);
        const ordered = [
          ...questions.filter((q) => answeredIds.includes(q.id)).map((q) => q.id),
          ...answeredIds.filter((id) => !byId.has(id)),
        ];

        return (
          <Card key={r.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {format(new Date(r.submitted_at), "d MMM yyyy, h:mm a")}
                </p>
                {i === 0 && <Badge variant="secondary">Latest</Badge>}
              </div>

              <dl className="grid gap-2 sm:grid-cols-2">
                {ordered.map((qid) => {
                  const q = byId.get(qid);
                  const value = r.answers[qid];
                  const before = prev?.answers[qid];

                  let delta: number | null = null;
                  if (q?.kind === "number" && before !== undefined) {
                    const a = Number(value);
                    const b = Number(before);
                    if (Number.isFinite(a) && Number.isFinite(b)) delta = a - b;
                  }

                  return (
                    <div key={qid} className="rounded-md border px-3 py-2">
                      <dt className="text-xs text-muted-foreground">
                        {q?.text ?? "(question removed)"}
                      </dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                        <span>
                          {value}
                          {q?.kind === "number" && q.unit ? ` ${q.unit}` : ""}
                        </span>
                        {delta !== null && (
                          <span
                            className={
                              delta > 0
                                ? "flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400"
                                : delta < 0
                                  ? "flex items-center gap-0.5 text-xs text-destructive"
                                  : "flex items-center gap-0.5 text-xs text-muted-foreground"
                            }
                          >
                            {delta > 0 ? (
                              <TrendingUp className="size-3" />
                            ) : delta < 0 ? (
                              <TrendingDown className="size-3" />
                            ) : (
                              <Minus className="size-3" />
                            )}
                            {delta > 0 ? `+${delta}` : delta === 0 ? "same" : delta}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
