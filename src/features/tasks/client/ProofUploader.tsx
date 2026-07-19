"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitProof } from "@/features/tasks/server/actions";
import { uploadFile, type UploadedFile } from "@/lib/client/upload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Paperclip, Trash2, Upload } from "lucide-react";

export function ProofUploader({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    setUploading(true);
    try {
      for (const file of selected) {
        const uploaded = await uploadFile(file, "proof");
        setFiles((f) => [...f, uploaded]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    startTransition(async () => {
      const res = await submitProof({
        task_id: taskId,
        file_keys: files.map((f) => f.key),
        student_note: note.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(
          res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error
        );
        return;
      }
      toast.success("Proof sent to Sir for review! 🎉");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="space-y-2">
        <Label>Upload proof of your work</Label>
        <p className="text-sm text-muted-foreground">
          Photos of your answers or a PDF — so Sir can check what you did.
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFiles}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="size-4" />
          {uploading ? "Uploading…" : "Choose photos / PDF"}
        </Button>
        {files.length > 0 && (
          <ul className="space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={f.key} className="flex items-center gap-2">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() => setFiles(files.filter((_, fi) => fi !== i))}
                  aria-label={`Remove ${f.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="proof-note">Note for Sir (optional)</Label>
        <Textarea
          id="proof-note"
          rows={2}
          placeholder="Anything you found hard?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Button className="w-full" disabled={pending || uploading} onClick={submit}>
        <Upload className="size-4" />
        {pending ? "Sending…" : "Send proof to Sir"}
      </Button>
    </div>
  );
}
