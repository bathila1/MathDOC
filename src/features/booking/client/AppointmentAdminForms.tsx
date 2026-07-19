"use client";

import { useState, useTransition } from "react";
import {
  saveMeetingLink,
  saveDiagnosis,
  setAppointmentStatus,
} from "@/features/booking/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function MeetingLinkForm({
  appointmentId,
  initial,
}: {
  appointmentId: string;
  initial: string | null;
}) {
  const [link, setLink] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Label htmlFor="meeting-link">Meeting link (online sessions)</Label>
      <div className="flex gap-2">
        <Input
          id="meeting-link"
          placeholder="https://meet.google.com/…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await saveMeetingLink({
                appointment_id: appointmentId,
                meeting_link: link.trim(),
              });
              if (!res.ok) {
                setError(res.fieldErrors?.meeting_link ?? res.error);
                return;
              }
              toast.success("Meeting link saved.");
            })
          }
        >
          Save
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function DiagnosisForm({
  appointmentId,
  initial,
}: {
  appointmentId: string;
  initial: string | null;
}) {
  const [notes, setNotes] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Label htmlFor="diagnosis">
        Diagnosis notes (what&apos;s holding this student back?)
      </Label>
      <Textarea
        id="diagnosis"
        rows={4}
        placeholder="e.g. Knows the theory but struggles with past-paper questions under time pressure…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await saveDiagnosis({
              appointment_id: appointmentId,
              diagnosis_notes: notes,
            });
            if (!res.ok) toast.error(res.error);
            else toast.success("Notes saved.");
          })
        }
      >
        {pending ? "Saving…" : "Save notes"}
      </Button>
    </div>
  );
}

export function StatusButtons({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  if (status === "completed" || status === "cancelled") return null;

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await setAppointmentStatus(appointmentId, "completed");
            if (!res.ok) toast.error(res.error);
            else toast.success("Marked as completed.");
          })
        }
      >
        Mark completed
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (!confirm("Cancel this appointment? The slot becomes free again.")) return;
            const res = await setAppointmentStatus(appointmentId, "cancelled");
            if (!res.ok) toast.error(res.error);
            else toast.success("Appointment cancelled.");
          })
        }
      >
        Cancel
      </Button>
    </div>
  );
}
