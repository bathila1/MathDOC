"use client";

import { useState, useTransition } from "react";
import { createSlot, deleteSlot } from "@/features/booking/server/actions";
import type { AvailabilitySlot } from "@/lib/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const modeLabels: Record<string, string> = {
  physical: "In person",
  online: "Online",
  either: "Either",
};

export function AvailabilityManager({ slots }: { slots: AvailabilitySlot[] }) {
  const [form, setForm] = useState({
    date: "",
    start_time: "",
    end_time: "",
    mode: "either",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function add() {
    setErrors({});
    startTransition(async () => {
      const res = await createSlot(form);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      toast.success("Slot added.");
      setForm((f) => ({ ...f, start_time: "", end_time: "" }));
    });
  }

  const byDate = new Map<string, AvailabilitySlot[]>();
  for (const s of slots) {
    const day = format(new Date(s.starts_at), "EEEE, d MMMM yyyy");
    byDate.set(day, [...(byDate.get(day) ?? []), s]);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a free time slot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="slot-date">Date</Label>
            <Input
              id="slot-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-start">Start</Label>
            <Input
              id="slot-start"
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />
            {errors.start_time && (
              <p className="text-xs text-destructive">{errors.start_time}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-end">End</Label>
            <Input
              id="slot-end"
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            />
            {errors.end_time && (
              <p className="text-xs text-destructive">{errors.end_time}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.mode}
              onValueChange={(mode) => setForm({ ...form, mode: mode ?? "either" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="either">Either</SelectItem>
                <SelectItem value="physical">In person</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={add} disabled={pending} className="w-full">
              <Plus className="size-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {[...byDate.entries()].map(([day, daySlots]) => (
        <Card key={day}>
          <CardHeader>
            <CardTitle className="text-base">{day}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {daySlots.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  {format(new Date(s.starts_at), "h:mm a")} –{" "}
                  {format(new Date(s.ends_at), "h:mm a")}
                </span>
                <Badge variant={s.status === "free" ? "secondary" : "default"}>
                  {s.status === "free" ? modeLabels[s.mode] : "Booked"}
                </Badge>
                {s.status === "free" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() =>
                      startTransition(async () => {
                        const res = await deleteSlot(s.id);
                        if (!res.ok) toast.error(res.error);
                      })
                    }
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      {slots.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          No upcoming slots. Add your free times above so students can book.
        </p>
      )}
    </div>
  );
}
