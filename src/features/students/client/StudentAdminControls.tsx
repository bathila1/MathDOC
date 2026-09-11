"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStudent,
  deleteStudent,
} from "@/features/students/server/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Trash2, UserPlus } from "lucide-react";

/** Add a student who signed up in person. */
export function AddStudentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await createStudent({
        full_name: fullName,
        email,
        password,
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      toast.success(
        `${fullName} added. They log in with ${email} and the password you set.`
      );
      setOpen(false);
      setFullName("");
      setEmail("");
      setPassword("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="size-4" /> Add student
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a student</DialogTitle>
          <DialogDescription>
            For students who enrolled in person. Set a first password and hand
            it to them — they can change it from their profile page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">Full name</Label>
            <Input
              id="new-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Kamal Perera"
              autoFocus
            />
            {fieldErrors.full_name && (
              <p className="text-sm text-destructive">{fieldErrors.full_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-email">Email address</Label>
            <Input
              id="new-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
            />
            {fieldErrors.email && (
              <p className="text-sm text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">First password</Label>
            <Input
              id="new-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
              autoComplete="off"
            />
            {fieldErrors.password ? (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            ) : (
              // Shown as plain text on purpose: the teacher has to read this
              // out to the student, and a masked box they cannot check is how
              // typos become "the login doesn't work".
              <p className="text-xs text-muted-foreground">
                At least 10 characters, including a letter and a number. Write
                it down for them before saving.
              </p>
            )}
          </div>

          <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            They&apos;ll be asked for their phone number, school, grade and
            guardian details the first time they log in.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Permanently remove a student. Typing the name is required — a plain
 * "are you sure?" is too easy to click past for something irreversible, and it
 * guarantees the teacher is looking at the student they think they are.
 */
export function DeleteStudentButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteStudent(studentId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${studentName} deleted.`);
      setOpen(false);
      router.refresh();
      router.push("/admin/students");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v: boolean) => {
        setOpen(v);
        if (v) setTyped("");
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Trash2 className="size-4 text-destructive" /> Delete student
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" /> Delete {studentName}?
          </DialogTitle>
          <DialogDescription>
            This removes their account and everything belonging to them — tasks,
            proofs, bookings, invoices, notes and certificates. It cannot be
            undone, and they will no longer be able to log in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-name">
            Type <span className="font-semibold">{studentName}</span> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending || typed.trim() !== studentName.trim()}
            onClick={remove}
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
