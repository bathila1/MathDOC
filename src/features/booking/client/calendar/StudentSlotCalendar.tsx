"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { bookSlot } from "@/features/booking/server/actions";
import type { AvailabilitySlot } from "@/lib/shared/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Laptop, Users } from "lucide-react";
import { WeekCalendar } from "./WeekCalendar";
import { heightOf, sameDay, topOf } from "./calendar-utils";

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
    () => slots.filter((s) => s.mode === "either" || s.mode === mode),
    [slots, mode]
  );

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
    <div className="space-y-4">
      <Tabs
        value={mode}
        onValueChange={(v) => {
          setMode(v as typeof mode);
          setSelected(null);
        }}
      >
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="physical">
            <Users className="size-4" /> In person
          </TabsTrigger>
          <TabsTrigger value="online">
            <Laptop className="size-4" /> Online
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <WeekCalendar
        anchor={anchor}
        onAnchorChange={setAnchor}
        legend={
          <p className="text-xs font-semibold text-muted-foreground">
            🟠 Tap a free time to pick it
          </p>
        }
        renderDay={(day) => (
          <>
            {visible
              .filter((s) => sameDay(new Date(s.starts_at), day))
              .map((s) => {
                const isSelected = selected?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : s)}
                    style={{
                      top: topOf(s.starts_at),
                      height: heightOf(s.starts_at, s.ends_at),
                    }}
                    className={cn(
                      "pointer-events-auto absolute inset-x-1 z-10 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight font-bold shadow-sm transition-all",
                      isSelected
                        ? "scale-[1.03] bg-brand-gradient border-white text-white shadow-lg"
                        : "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {format(new Date(s.starts_at), "h:mm a")}
                    <span className="block font-medium opacity-80">
                      {isSelected ? "Selected ✔" : "Free"}
                    </span>
                  </button>
                );
              })}
          </>
        )}
      />

      {visible.length === 0 && (
        <p className="py-4 text-center text-muted-foreground">
          No free {mode === "online" ? "online" : "in-person"} times right now —
          please check back soon.
        </p>
      )}

      <div className="sticky bottom-4 z-30">
        <Button
          size="lg"
          className="w-full bg-brand-gradient border-0 text-white shadow-xl disabled:opacity-60"
          disabled={!selected || pending}
          onClick={confirm}
        >
          {pending
            ? "Booking…"
            : selected
              ? `${followUpTaskId ? "Book follow-up" : "Continue"} — ${format(new Date(selected.starts_at), "EEE d MMM, h:mm a")}`
              : "Pick a time above ☝️"}
        </Button>
      </div>
    </div>
  );
}
