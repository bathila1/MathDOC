"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSessionNote,
  deleteSessionNote,
} from "@/features/booking/server/actions";
import type { SessionNote } from "@/lib/shared/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatSchool as format } from "@/lib/shared/time";
import { Plus, Trash2 } from "lucide-react";

/**
 * Notes are added one at a time during a session. They belong to the
 * student (not just the appointment), so they also appear on their profile.
 */
export function SessionNotes({
  appointmentId,
  notes,
}: {
  appointmentId: string;
  notes: SessionNote[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addSessionNote({ appointment_id: appointmentId, body });
      if (!res.ok) {
        setError(res.fieldErrors?.body ?? res.error);
        return;
      }
      setBody("");
      // The list is rendered from server props, so pull them again — without
      // this a saved note doesn't appear until a manual reload, which reads
      // as "adding notes doesn't work".
      router.refresh();
      toast.success("Note added.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="note-body">Add a note</Label>
        <Textarea
          id="note-body"
          rows={2}
          placeholder="e.g. Struggles with time pressure on past papers."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add();
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="sm" disabled={pending || !body.trim()} onClick={add}>
          <Plus className="size-4" />
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>

      {notes.length > 0 && (
        <ul className="space-y-2 border-t pt-3">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(n.created_at), "d MMM yyyy, h:mm a")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label="Delete note"
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteSessionNote(n.id);
                    if (!res.ok) toast.error(res.error);
                    else router.refresh();
                  })
                }
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
