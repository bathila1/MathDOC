"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookSlot } from "@/features/booking/server/actions";
import type { AvailabilitySlot } from "@/lib/shared/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";

export function SlotPicker({
  slots,
  followUpTaskId,
}: {
  slots: AvailabilitySlot[];
  followUpTaskId?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"physical" | "online">("physical");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () => slots.filter((s) => s.mode === "either" || s.mode === mode),
    [slots, mode]
  );

  const byDate = useMemo(() => {
    const groups = new Map<string, AvailabilitySlot[]>();
    for (const s of visible) {
      const day = format(new Date(s.starts_at), "EEEE, d MMMM yyyy");
      groups.set(day, [...(groups.get(day) ?? []), s]);
    }
    return [...groups.entries()];
  }, [visible]);

  function confirm() {
    if (!selected) return;
    startTransition(async () => {
      const res = await bookSlot({
        slot_id: selected,
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
      <Tabs value={mode} onValueChange={(v) => { setMode(v as typeof mode); setSelected(null); }}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="physical">In person</TabsTrigger>
          <TabsTrigger value="online">Online</TabsTrigger>
        </TabsList>
      </Tabs>

      {byDate.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          No free {mode === "online" ? "online" : "in-person"} times right now —
          please check back soon.
        </p>
      ) : (
        byDate.map(([day, daySlots]) => (
          <Card key={day}>
            <CardHeader>
              <CardTitle className="text-base">{day}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {daySlots.map((s) => (
                <Button
                  key={s.id}
                  variant={selected === s.id ? "default" : "outline"}
                  onClick={() => setSelected(s.id)}
                >
                  {format(new Date(s.starts_at), "h:mm a")} –{" "}
                  {format(new Date(s.ends_at), "h:mm a")}
                </Button>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <div className="sticky bottom-4">
        <Button
          size="lg"
          className="w-full"
          disabled={!selected || pending}
          onClick={confirm}
        >
          {pending
            ? "Booking…"
            : followUpTaskId
              ? "Book follow-up with Sir"
              : "Continue"}
        </Button>
      </div>
    </div>
  );
}
