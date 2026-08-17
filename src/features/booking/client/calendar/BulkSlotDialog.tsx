"use client";

import { useMemo, useState, useTransition } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { createSlotsBulk } from "@/features/booking/server/actions";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarRange } from "lucide-react";
import {
  DEFAULT_END_HOUR,
  DEFAULT_START_HOUR,
  localInstant,
  minutesFromTime,
} from "./calendar-utils";

const WEEKDAYS = [
  { label: "Mon", index: 1 },
  { label: "Tue", index: 2 },
  { label: "Wed", index: 3 },
  { label: "Thu", index: 4 },
  { label: "Fri", index: 5 },
  { label: "Sat", index: 6 },
  { label: "Sun", index: 0 },
];

function timeOptions(): string[] {
  const out: string[] = [];
  for (let h = DEFAULT_START_HOUR; h <= DEFAULT_END_HOUR; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < DEFAULT_END_HOUR) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

/**
 * "Every Mon & Wed, 4–5pm, for the next 6 weeks" in one go, instead of
 * clicking out each slot by hand.
 *
 * Times are resolved to instants HERE, in the browser, for the same reason
 * single slots are — see localInstant().
 */
export function BulkSlotDialog() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("16:00");
  const [end, setEnd] = useState("17:00");
  const [weeks, setWeeks] = useState("4");
  const [mode, setMode] = useState("either");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Captured when the dialog opens, not read during render: calling Date.now()
  // inside the memo below makes rendering impure and leaves the preview stale
  // as time passes.
  const [now, setNow] = useState(0);

  // Everything the pattern expands to, from today forward.
  const planned = useMemo(() => {
    const from = minutesFromTime(start);
    const to = minutesFromTime(end);
    if (days.length === 0 || to <= from) return [];

    const out: { starts_at: string; ends_at: string; day: Date }[] = [];
    const weekCount = Number(weeks) || 0;
    const firstMonday = startOfWeek(new Date(now || Date.parse("2000-01-01")), {
      weekStartsOn: 1,
    });

    for (let w = 0; w < weekCount; w++) {
      for (const d of days) {
        // date-fns weeks start Monday here, so Sunday (0) belongs to the end.
        const offset = d === 0 ? 6 : d - 1;
        const day = addDays(firstMonday, w * 7 + offset);
        const starts_at = localInstant(day, from);
        if (Date.parse(starts_at) <= now) continue; // skip times already gone
        out.push({ starts_at, ends_at: localInstant(day, to), day });
      }
    }
    return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [days, start, end, weeks, now]);

  function toggleDay(index: number) {
    setDays((d) =>
      d.includes(index) ? d.filter((x) => x !== index) : [...d, index]
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await createSlotsBulk({
        slots: planned.map(({ starts_at, ends_at }) => ({ starts_at, ends_at })),
        mode,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { created, skipped } = res.data;
      toast.success(
        skipped > 0
          ? `Added ${created} time${created === 1 ? "" : "s"} — skipped ${skipped} that clashed.`
          : `Added ${created} time${created === 1 ? "" : "s"}.`
      );
      setOpen(false);
      setDays([]);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v: boolean) => {
        setOpen(v);
        if (v) setNow(Date.now());
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <CalendarRange className="size-4" /> Add many times
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add many times at once</DialogTitle>
          <DialogDescription>
            Pick the days and the time — the same slot is added every week.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Which days?</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const active = days.includes(d.index);
                return (
                  <button
                    key={d.index}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDay(d.index)}
                    className={cn(
                      "min-w-12 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Time</Label>
            <div className="flex items-center gap-2">
              <Select value={start} onValueChange={(v: string | null) => setStart(v ?? start)}>
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
              <Select value={end} onValueChange={(v: string | null) => setEnd(v ?? end)}>
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
            {minutesFromTime(end) <= minutesFromTime(start) && (
              <p className="text-sm text-destructive">
                End time must be after the start time.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Repeat for</Label>
              <Select value={weeks} onValueChange={(v: string | null) => setWeeks(v ?? weeks)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "4", "6", "8", "12"].map((w) => (
                    <SelectItem key={w} value={w}>
                      {w} week{w === "1" ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meeting type</Label>
              <Select value={mode} onValueChange={(v: string | null) => setMode(v ?? mode)}>
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

          {/* Say exactly what will happen before it happens. */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            {planned.length === 0 ? (
              <span className="text-muted-foreground">
                Pick at least one day to see what will be added.
              </span>
            ) : (
              <>
                <span className="font-semibold">
                  {planned.length} time{planned.length === 1 ? "" : "s"} will be
                  added
                </span>
                <span className="block text-muted-foreground">
                  {format(new Date(planned[0].starts_at), "EEE d MMM")} –{" "}
                  {format(
                    new Date(planned[planned.length - 1].starts_at),
                    "EEE d MMM"
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Anything that clashes with an existing slot is skipped.
                </span>
              </>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={pending || planned.length === 0} onClick={save}>
            {pending ? "Adding…" : `Add ${planned.length || ""} time${planned.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
