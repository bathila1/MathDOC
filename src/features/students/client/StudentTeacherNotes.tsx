"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addStudentNote,
  deleteStudentNote,
} from "@/features/students/server/actions";
import type { StudentTeacherNote } from "@/lib/shared/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

/** Private, admin-only notes about a student, shown as timestamped cards. */
export function StudentTeacherNotes({
  studentId,
  notes,
}: {
  studentId: string;
  notes: StudentTeacherNote[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addStudentNote({ student_id: studentId, body });
      if (!res.ok) {
        setError(res.fieldErrors?.body ?? res.error);
        return;
      }
      setBody("");
      toast.success("Private note saved.");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteStudentNote(id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          rows={2}
          placeholder="Only you can see this — reminders, things to watch, follow-ups…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add();
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="sm" disabled={pending || !body.trim()} onClick={add}>
          <Plus className="size-4" />
          {pending ? "Saving…" : "Add private note"}
        </Button>
      </div>

      {notes.length > 0 ? (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 whitespace-pre-line">{n.body}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label="Delete note"
                  disabled={pending}
                  onClick={() => remove(n.id)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(new Date(n.created_at), "d MMM yyyy, h:mm a")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No private notes yet.</p>
      )}
    </div>
  );
}
