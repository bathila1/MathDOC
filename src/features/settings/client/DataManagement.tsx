"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearData } from "@/features/settings/server/data-actions";
import {
  CLEAR_SCOPES,
  CLEAR_CONFIRM_PHRASE,
  type ClearScope,
} from "@/lib/shared/data-scopes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AlertTriangle, Trash2 } from "lucide-react";

/**
 * Pick exactly what to erase, then confirm by typing.
 *
 * Two deliberate frictions, because this cannot be undone: nothing is selected
 * by default, and the final button stays disabled until the confirmation word
 * is typed EXACTLY (the server enforces the same thing, so the disabled button
 * is a convenience rather than the protection).
 */
export function DataManagement() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<ClearScope>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const chosen = CLEAR_SCOPES.filter((s) => selected.has(s.key));
  const deletesAccounts = selected.has("students");

  function toggle(key: ClearScope) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(CLEAR_SCOPES.map((s) => s.key)));
  }

  function run() {
    startTransition(async () => {
      const res = await clearData({
        scopes: [...selected],
        confirm: typed.trim(),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.cleared.length > 0
          ? `Cleared: ${res.data.cleared.join(", ")}.`
          : "Nothing to clear."
      );
      setConfirmOpen(false);
      setSelected(new Set());
      setTyped("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {CLEAR_SCOPES.map((s) => {
          const active = selected.has(s.key);
          return (
            <label
              key={s.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                active
                  ? s.key === "students"
                    ? "border-destructive bg-destructive/5"
                    : "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <Checkbox
                checked={active}
                onCheckedChange={() => toggle(s.key)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {s.label}
                  {s.key === "students" && (
                    <span className="ml-2 text-xs font-bold text-destructive">
                      most destructive
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {s.detail}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={selectAll}
          disabled={selected.size === CLEAR_SCOPES.length}
        >
          Select everything
        </Button>
        {selected.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          className="ml-auto"
          disabled={selected.size === 0}
          onClick={() => {
            setTyped("");
            setConfirmOpen(true);
          }}
        >
          <Trash2 className="size-4" />
          Clear selected ({selected.size})
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              This cannot be undone
            </DialogTitle>
            <DialogDescription>
              You are about to permanently delete:
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1 rounded-lg bg-muted/60 p-3 text-sm">
            {chosen.map((s) => (
              <li key={s.key} className="flex gap-2">
                <span className="text-destructive">•</span>
                <span>
                  <span className="font-semibold">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {deletesAccounts && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              Students will lose access immediately and cannot log in again.
              Your own teacher account is not affected.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Uploaded files stay in storage but become unreachable from the app.
          </p>

          <div className="space-y-2">
            <Label htmlFor="confirm-phrase">
              Type <span className="font-mono font-bold">{CLEAR_CONFIRM_PHRASE}</span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-phrase"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder={CLEAR_CONFIRM_PHRASE}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || typed.trim() !== CLEAR_CONFIRM_PHRASE}
              onClick={run}
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
