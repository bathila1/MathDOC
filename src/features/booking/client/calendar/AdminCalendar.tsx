"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { createSlot, deleteSlot } from "@/features/booking/server/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarPlus, Clock, Laptop, Trash2, Users } from "lucide-react";
import { WeekCalendar } from "./WeekCalendar";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  heightOf,
  sameDay,
  topOf,
} from "./calendar-utils";
import type { AvailabilitySlot } from "@/lib/shared/types";

export type AdminSlot = AvailabilitySlot & {
  appointments?: { status: string; profiles: { full_name: string | null } | null }[];
};

const modeLabels: Record<string, string> = {
  physical: "In person",
  online: "Online",
  either: "Either",
};

function timeOptions(): string[] {
  const out: string[] = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < DAY_END_HOUR) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

/**
 * Google-Calendar-style availability manager: click an empty cell to create
 * a slot (event-creation dialog), click a slot to manage it.
 */
export function AdminCalendar({ slots }: { slots: AdminSlot[] }) {
  const [anchor, setAnchor] = useState(new Date());
  const [pending, startTransition] = useTransition();

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    date: "",
    start_time: "16:00",
    end_time: "17:00",
    mode: "either",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // manage dialog
  const [managed, setManaged] = useState<AdminSlot | null>(null);

  function openCreate(day: Date, hour: number) {
    const start = `${String(hour).padStart(2, "0")}:00`;
    const end = `${String(Math.min(hour + 1, DAY_END_HOUR)).padStart(2, "0")}:00`;
    setDraft({
      date: format(day, "yyyy-MM-dd"),
      start_time: start,
      end_time: end,
      mode: "either",
    });
    setErrors({});
    setCreateOpen(true);
  }

  function saveDraft() {
    setErrors({});
    startTransition(async () => {
      const res = await createSlot(draft);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      toast.success("Free time added.");
      setCreateOpen(false);
    });
  }

  function removeManaged() {
    if (!managed) return;
    startTransition(async () => {
      const res = await deleteSlot(managed.id);
      if (!res.ok) toast.error(res.error);
      else toast.success("Slot removed.");
      setManaged(null);
    });
  }

  const bookedBy = (s: AdminSlot) =>
    s.appointments?.find((a) => a.status !== "cancelled")?.profiles?.full_name;

  return (
    <div className="space-y-4">
      <WeekCalendar
        anchor={anchor}
        onAnchorChange={setAnchor}
        onCellClick={openCreate}
        legend={
          <p className="text-xs font-medium text-muted-foreground">
            Click any empty space to add a free time
          </p>
        }
        renderDay={(day) => (
          <>
            {slots
              .filter((s) => sameDay(new Date(s.starts_at), day))
              .map((s) => {
                const booked = s.status === "booked";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setManaged(s)}
                    style={{
                      top: topOf(s.starts_at),
                      height: heightOf(s.starts_at, s.ends_at),
                    }}
                    className={cn(
                      "pointer-events-auto absolute inset-x-1 z-10 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight font-bold shadow-sm transition-transform hover:scale-[1.02]",
                      booked
                        ? "bg-primary border-primary-foreground text-primary-foreground"
                        : "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    )}
                  >
                    {format(new Date(s.starts_at), "h:mm a")}
                    <span className="block font-medium opacity-85">
                      {booked ? (bookedBy(s) ?? "Booked") : `Free · ${modeLabels[s.mode]}`}
                    </span>
                  </button>
                );
              })}
          </>
        )}
      />

      {/* Create slot — Google Calendar event vibe */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CalendarPlus className="size-4" />
              </span>
              Add free time
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-bold">
              {draft.date &&
                format(new Date(`${draft.date}T00:00`), "EEEE, d MMMM yyyy")}
            </p>
            <div className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <Select
                value={draft.start_time}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, start_time: v ?? d.start_time }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions().map((t) => (
                    <SelectItem key={t} value={t}>
                      {format(new Date(`2000-01-01T${t}`), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">→</span>
              <Select
                value={draft.end_time}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, end_time: v ?? d.end_time }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions().map((t) => (
                    <SelectItem key={t} value={t}>
                      {format(new Date(`2000-01-01T${t}`), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(errors.end_time || errors.date || errors.start_time) && (
              <p className="text-sm text-destructive">
                {errors.end_time ?? errors.date ?? errors.start_time}
              </p>
            )}
            <div className="space-y-2">
              <Label>Meeting type</Label>
              <Select
                value={draft.mode}
                onValueChange={(v) => setDraft((d) => ({ ...d, mode: v ?? d.mode }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="either">Either</SelectItem>
                  <SelectItem value="physical">In person only</SelectItem>
                  <SelectItem value="online">Online only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={saveDraft}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage slot */}
      <Dialog open={!!managed} onOpenChange={(v) => !v && setManaged(null)}>
        <DialogContent className="sm:max-w-sm">
          {managed && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(new Date(managed.starts_at), "EEEE, d MMMM")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <Clock className="size-4 text-muted-foreground" />
                  {format(new Date(managed.starts_at), "h:mm a")} –{" "}
                  {format(new Date(managed.ends_at), "h:mm a")}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  {managed.mode === "online" ? (
                    <Laptop className="size-4" />
                  ) : (
                    <Users className="size-4" />
                  )}
                  {modeLabels[managed.mode]}
                </p>
                {managed.status === "booked" ? (
                  <p className="mt-2 rounded-lg bg-muted p-2 font-semibold">
                    Booked by {bookedBy(managed) ?? "a student"}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    This time is free — students can book it.
                  </p>
                )}
              </div>
              {managed.status === "free" && (
                <DialogFooter>
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={removeManaged}
                  >
                    <Trash2 className="size-4" /> Remove this slot
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
