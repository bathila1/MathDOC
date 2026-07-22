"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { reviewProof } from "@/features/tasks/server/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, ExternalLink, X } from "lucide-react";
import { format } from "date-fns";

export interface ProofForReview {
  id: string;
  submitted_at: string;
  student_note: string | null;
  student_name: string;
  /** Where this proof came from — links shown on the card. */
  studentHref?: string;
  sessionHref?: string | null;
  task_title: string;
  files: { name: string; url: string }[];
}

export function ProofReviewCard({ proof }: { proof: ProofForReview }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function decide(decision: "accepted" | "rejected") {
    startTransition(async () => {
      const res = await reviewProof({
        proof_id: proof.id,
        decision,
        teacher_note: note.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === "accepted" ? "Proof accepted ✔" : "Sent back to the student.");
      setRejectOpen(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {proof.student_name} — {proof.task_title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Submitted {format(new Date(proof.submitted_at), "d MMM yyyy, h:mm a")}
        </p>
        <p className="flex flex-wrap gap-x-3 text-sm">
          {proof.studentHref && (
            <Link
              href={proof.studentHref}
              className="text-primary underline underline-offset-2"
            >
              View student
            </Link>
          )}
          {proof.sessionHref && (
            <Link
              href={proof.sessionHref}
              className="text-primary underline underline-offset-2"
            >
              View session
            </Link>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {proof.student_note && (
          <p className="rounded-md bg-muted p-3 text-sm">
            “{proof.student_note}”
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {proof.files.map((f, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              render={<a href={f.url} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink className="size-4" /> {f.name}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={pending} onClick={() => decide("accepted")}>
            <Check className="size-4" /> Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setRejectOpen(true)}
          >
            <X className="size-4" /> Reject
          </Button>
        </div>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send back to {proof.student_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`note-${proof.id}`}>
                Tell the student what to fix
              </Label>
              <Textarea
                id={`note-${proof.id}`}
                rows={3}
                placeholder="e.g. Question 4 and 7 are wrong — redo them showing your working."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => decide("rejected")}
              >
                {pending ? "Sending…" : "Reject with note"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
