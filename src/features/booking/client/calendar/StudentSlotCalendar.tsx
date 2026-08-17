"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { bookSlot } from "@/features/booking/server/actions";
import type { AvailabilitySlot } from "@/lib/shared/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, Laptop, Users } from "lucide-react";
import { WeekCalendar } from "./WeekCalendar";
import { layoutDaySlots, rangeForSlots, sameDay } from "./calendar-utils";

/** Google-Calendar-style slot picker: tap a card on the week grid to select. */
export function StudentSlotCalendar({
  slots,
  followUpTaskId,
}: {
  slots: AvailabilitySlot[];
  followUpTaskId?: string;
}) {
  const router = useRouter();
  const [anchor, setAnchor] = useState(new Date());
  const [mode, setMode] = useState<"physical" | "online">("physical");
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      slots.filter(
        (s) => s.status === "booked" || s.mode === "either" || s.mode === mode
      ),
    [slots, mode]
  );
  const hasFree = visible.some((s) => s.status === "free");
  // Widen the grid so early/late slots stay inside the calendar box.
  const range = useMemo(() => rangeForSlots(visible), [visible]);

  function confirm() {
    if (!selected) return;
    startTransition(async () => {
      const res = await bookSlot({
        slot_id: selected.id,
        mode,
        follow_up_task_id: followUpTaskId,
      });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      if (res.data.needsPayment) {
        router.push(`/student/book/payment/${res.data.appointmentId}`);
      } else {
        router.push(`/student/book/confirmed/${res.data.appointmentId}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* How do you want to meet? — big, obvious choice */}
      <div>
        <p className="mb-3 text-sm font-semibold">How would you like to meet?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "physical" as const,
                icon: Users,
                title: "In person",
                hint: "Meet Sir face to face",
              },
              {
                value: "online" as const,
                icon: Laptop,
                title: "Online",
                hint: "Join by video call",
              },
            ]
          ).map((opt) => {
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setMode(opt.value);
                  setSelected(null);
                }}
                className={cn(
                  "flex items-center gap-4 rounded-2xl p-5 text-left shadow-sm ring-1 transition-all",
                  active
                    ? "bg-primary/5 ring-2 ring-primary"
                    : "bg-card ring-border/60 hover:bg-muted/40 hover:ring-primary/30"
                )}
              >
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <opt.icon className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold">{opt.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {opt.hint}
                  </span>
                </span>
                {active && <Check className="size-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      <WeekCalendar
        anchor={anchor}
        onAnchorChange={setAnchor}
        range={range}
        legend={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary" />
              Free — tap to choose
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-sm bg-muted-foreground/40" />
              Taken
            </span>
          </div>
        }
        renderDay={(day) =>
          layoutDaySlots(
            visible.filter((s) => sameDay(new Date(s.starts_at), day)),
            range
          ).map(({ slot: s, top, height, leftPct, widthPct }) => {
            const style = {
              top,
              height,
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
            };
            const timeLabel = `${format(new Date(s.starts_at), "h:mm")}–${format(
              new Date(s.ends_at),
              "h:mm a"
            )}`;

            // Taken times stay visible but dimmed, so the week doesn't look
            // emptier than it is and students can see Sir is busy then.
            if (s.status === "booked") {
              return (
                <div
                  key={s.id}
                  style={style}
                  title={`${timeLabel} — already taken`}
                  className="pointer-events-none absolute z-10 overflow-hidden rounded-lg border-l-4 border-muted-foreground/40 bg-muted px-1.5 py-1 text-left text-[11px] leading-tight font-bold text-muted-foreground opacity-60 sm:px-2 sm:text-xs"
                >
                  {timeLabel}
                  <span className="block font-medium">Taken</span>
                </div>
              );
            }

            const isSelected = selected?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={isSelected}
                title={`${timeLabel} — tap to choose`}
                onClick={() => setSelected(isSelected ? null : s)}
                style={style}
                className={cn(
                  "pointer-events-auto absolute z-10 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight font-bold shadow-sm transition-all sm:px-2 sm:text-xs",
                  isSelected
                    ? "bg-primary border-primary-foreground text-primary-foreground shadow-md ring-2 ring-primary"
                    : "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                )}
              >
                {timeLabel}
                <span className="block font-medium opacity-80">
                  {isSelected ? "✓ Chosen" : "Free"}
                </span>
              </button>
            );
          })
        }
      />

      {!hasFree && (
        <p className="py-4 text-center text-muted-foreground">
          No free {mode === "online" ? "online" : "in-person"} times right now —
          please check back soon.
        </p>
      )}

      <div className="sticky bottom-4 z-30">
        <Button
          size="lg"
          className="w-full shadow-lg"
          disabled={!selected || pending}
          onClick={confirm}
        >
          {pending
            ? "Booking…"
            : selected
              ? `${followUpTaskId ? "Book follow-up" : "Continue"} — ${format(new Date(selected.starts_at), "EEE d MMM, h:mm a")}`
              : "Pick a time above"}
        </Button>
      </div>
    </div>
  );
}
