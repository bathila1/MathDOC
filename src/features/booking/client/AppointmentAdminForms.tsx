"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveMeetingLink,
  saveDiagnosis,
  setAppointmentStatus,
} from "@/features/booking/server/actions";
import { uploadFile } from "@/lib/client/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";

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
  initialImages = [],
  imageUrls = {},
}: {
  appointmentId: string;
  initial: string | null;
  /** Stored R2 keys. */
  initialImages?: string[];
  /** key -> presigned URL, resolved on the server for previewing. */
  imageUrls?: Record<string, string>;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial ?? "");
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    if (images.length + picked.length > 10) {
      toast.error("Maximum 10 images.");
      return;
    }
    setUploading(true);
    try {
      for (const file of picked) {
        const up = await uploadFile(file, "question_image");
        setImages((prev) => [...prev, up.key]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

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

      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((key) => (
            <li key={key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrls[key] ?? ""}
                alt="Diagnosis attachment"
                className="size-20 rounded-md border object-cover"
              />
              <button
                type="button"
                aria-label="Remove image"
                className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white"
                onClick={() => setImages(images.filter((k) => k !== key))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFiles}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={uploading || pending}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          {uploading ? "Uploading…" : "Add image"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || uploading}
          onClick={() =>
            startTransition(async () => {
              const res = await saveDiagnosis({
                appointment_id: appointmentId,
                diagnosis_notes: notes,
                diagnosis_image_keys: images,
              });
              if (!res.ok) toast.error(res.error);
              else {
                router.refresh();
                toast.success("Notes saved.");
              }
            })
          }
        >
          {pending ? "Saving…" : "Save notes"}
        </Button>
      </div>
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
