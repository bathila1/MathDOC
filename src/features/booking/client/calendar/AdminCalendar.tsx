"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  createSlot,
  deleteSlot,
  updateSlot,
} from "@/features/booking/server/actions";
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
import { appointmentCode } from "@/lib/shared/appointments";
import { CalendarPlus, Clock, Laptop, Trash2, Users } from "lucide-react";
import { WeekCalendar } from "./WeekCalendar";
import {
  DEFAULT_END_HOUR,
  DEFAULT_START_HOUR,
  heightOf,
  rangeForSlots,
  sameDay,
  topOf,
} from "./calendar-utils";
import type { AvailabilitySlot } from "@/lib/shared/types";

export type AdminSlot = AvailabilitySlot & {
  appointments?: {
    id: string;
    status: string;
    profiles: { full_name: string | null } | null;
  }[];
};

const modeLabels: Record<string, string> = {
  physical: "In person",
  online: "Online",
  either: "Either",
};

function timeOptions(): string[] {
  const out: string[] = [];
  for (let h = DEFAULT_START_HOUR; h <= DEFAULT_END_HOUR; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < DEFAULT_END_HOUR) out.push(`${String(h).padStart(2, "0")}:30`);
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
  // Widen the grid so early/late slots stay inside the calendar box.
  const range = useMemo(() => rangeForSlots(slots), [slots]);

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
    const end = `${String(Math.min(hour + 1, DEFAULT_END_HOUR)).padStart(2, "0")}:00`;
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
        range={range}
        legend={
          <p className="text-xs font-medium text-muted-foreground">
            Click any empty space to add a free time
          </p>
        }
        renderDay={(day) =>
          slots
            .filter((s) => sameDay(new Date(s.starts_at), day))
            .sort(
              (a, b) =>
                new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
            )
            .map((s, idx) => {
              const booked = s.status === "booked";
              const appt = s.appointments?.find((a) => a.status !== "cancelled");
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setManaged(s)}
                  style={{
                    top: topOf(s.starts_at, range),
                    height: heightOf(s.starts_at, s.ends_at),
                  }}
                  className={cn(
                    "pointer-events-auto absolute inset-x-0.5 z-10 overflow-hidden rounded-lg border-l-4 py-1 pr-7 pl-2 text-left text-[11px] leading-tight font-bold shadow-sm ring-1 transition-shadow hover:shadow-md sm:inset-x-1 sm:text-xs",
                    booked
                      ? "border-primary bg-primary/15 text-primary ring-primary/30 dark:bg-primary/25"
                      : "border-emerald-500 bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
                  )}
                >
                  {/* Big, noticeable slot number in the top-right corner */}
                  <span
                    className={cn(
                      "absolute top-0.5 right-0.5 flex min-w-5 items-center justify-center rounded-md px-1 text-sm font-black tabular-nums shadow-sm sm:text-base",
                      booked
                        ? "bg-primary text-primary-foreground"
                        : "bg-emerald-600 text-white"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="block">
                    {format(new Date(s.starts_at), "h:mm")}
                  </span>
                  <span className="block truncate font-medium opacity-85">
                    {booked ? (bookedBy(s) ?? "Booked") : modeLabels[s.mode]}
                  </span>
                  {appt && (
                    <span className="block truncate font-mono text-[9px] font-semibold opacity-40 sm:text-[10px]">
                      #{appointmentCode(appt.id)}
                    </span>
                  )}
                </button>
              );
            })
        }
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
                {managed.status === "booked" ? (
                  <>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      {managed.mode === "online" ? (
                        <Laptop className="size-4" />
                      ) : (
                        <Users className="size-4" />
                      )}
                      {modeLabels[managed.mode]}
                    </p>
                    <p className="mt-2 rounded-lg bg-muted p-2 font-semibold">
                      Booked by {bookedBy(managed) ?? "a student"}
                    </p>
                  </>
                ) : (
                  <div className="space-y-2 pt-1">
                    <Label>Meeting type</Label>
                    <Select
                      value={managed.mode}
                      onValueChange={(v) => {
                        if (!v || v === managed.mode) return;
                        const mode = v as AdminSlot["mode"];
                        setManaged({ ...managed, mode });
                        startTransition(async () => {
                          const res = await updateSlot({
                            slot_id: managed.id,
                            mode,
                          });
                          if (!res.ok) toast.error(res.error);
                          else toast.success("Slot updated.");
                        });
                      }}
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
                    <p className="text-muted-foreground">
                      This time is free — students can book it.
                    </p>
                  </div>
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
