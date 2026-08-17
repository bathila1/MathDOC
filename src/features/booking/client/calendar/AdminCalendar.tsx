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
  layoutDaySlots,
  localInstant,
  minutesFromTime,
  rangeForSlots,
  sameDay,
  timeFromMinutes,
} from "./calendar-utils";
import { BulkSlotDialog } from "./BulkSlotDialog";
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
  // `day` is kept as a Date, not a "yyyy-MM-dd" string: the instant is built
  // from local date parts so it lands in the teacher's timezone, not the
  // server's. See localInstant().
  const [draft, setDraft] = useState<{
    day: Date | null;
    start_time: string;
    end_time: string;
    mode: string;
  }>({ day: null, start_time: "16:00", end_time: "17:00", mode: "either" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // manage dialog
  const [managed, setManaged] = useState<AdminSlot | null>(null);

  function openCreate(day: Date, startMinutes: number, endMinutes: number) {
    setDraft({
      day,
      start_time: timeFromMinutes(startMinutes),
      end_time: timeFromMinutes(Math.min(endMinutes, DEFAULT_END_HOUR * 60)),
      mode: "either",
    });
    setErrors({});
    setCreateOpen(true);
  }

  /** Human length of the drafted slot, e.g. "1 hr 30 min". */
  const durationLabel = useMemo(() => {
    const [sh, sm] = draft.start_time.split(":").map(Number);
    const [eh, em] = draft.end_time.split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    if (!Number.isFinite(mins) || mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(" ");
  }, [draft.start_time, draft.end_time]);

  function saveDraft() {
    setErrors({});
    const day = draft.day;
    if (!day) return;
    startTransition(async () => {
      const res = await createSlot({
        starts_at: localInstant(day, minutesFromTime(draft.start_time)),
        ends_at: localInstant(day, minutesFromTime(draft.end_time)),
        mode: draft.mode,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        // Overlap/date problems come back without a field, so surface them
        // inside the dialog instead of only as a toast the teacher may miss.
        if (!res.fieldErrors) setErrors({ starts_at: res.error });
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
      <div className="flex justify-end">
        <BulkSlotDialog />
      </div>
      <WeekCalendar
        anchor={anchor}
        onAnchorChange={setAnchor}
        onRangeSelect={openCreate}
        range={range}
        legend={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-emerald-500" />
              Free
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary" />
              Booked
            </span>
            <span className="text-muted-foreground">
              Click or drag on an empty space to add a free time
            </span>
          </div>
        }
        renderDay={(day) =>
          layoutDaySlots(
            slots.filter((s) => sameDay(new Date(s.starts_at), day)),
            range
          ).map(({ slot: s, top, height, leftPct, widthPct }) => {
            const booked = s.status === "booked";
            const appt = s.appointments?.find((a) => a.status !== "cancelled");
            // Anything narrower than a full column is sharing the hour with
            // another slot — that should not happen, so flag it for cleanup.
            const clashes = widthPct < 99;
            return (
              <button
                key={s.id}
                type="button"
                data-slot-card
                onClick={() => setManaged(s)}
                title={`${format(new Date(s.starts_at), "h:mm a")} – ${format(
                  new Date(s.ends_at),
                  "h:mm a"
                )}`}
                style={{
                  top,
                  height,
                  left: `calc(${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
                className={cn(
                  "pointer-events-auto absolute z-10 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight font-bold shadow-sm ring-1 transition-shadow hover:shadow-md sm:text-xs",
                  booked
                    ? "border-primary bg-primary/15 text-primary ring-primary/30 dark:bg-primary/25"
                    : "border-emerald-500 bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
                  clashes && "ring-2 ring-destructive"
                )}
              >
                <span className="block">
                  {format(new Date(s.starts_at), "h:mm")}–
                  {format(new Date(s.ends_at), "h:mm a")}
                </span>
                <span className="block truncate font-medium opacity-85">
                  {booked ? (bookedBy(s) ?? "Booked") : modeLabels[s.mode]}
                </span>
                {clashes && (
                  <span className="block truncate font-semibold text-destructive">
                    Clash!
                  </span>
                )}
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
              {draft.day && format(draft.day, "EEEE, d MMMM yyyy")}
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
            {/* Live duration so the length is obvious before saving. */}
            {durationLabel && (
              <p className="text-xs font-medium text-muted-foreground">
                Length: {durationLabel}
              </p>
            )}
            {(errors.ends_at || errors.starts_at) && (
              <p className="text-sm text-destructive">
                {errors.ends_at ?? errors.starts_at}
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
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={pending} onClick={saveDraft}>
              {pending ? "Saving…" : "Add free time"}
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
