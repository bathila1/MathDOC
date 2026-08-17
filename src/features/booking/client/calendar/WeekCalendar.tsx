"use client";

import { useState } from "react";
import { addDays } from "date-fns";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RANGE,
  HOUR_PX,
  hoursOfDay,
  sameDay,
  SNAP_MINUTES,
  timeFromMinutes,
  weekDaysFor,
  type HourRange,
} from "./calendar-utils";

/**
 * Google-Calendar-style week grid: time gutter + 7 day columns.
 * Content (slot cards) is rendered per day via renderDay; empty-cell clicks
 * bubble up via onCellClick (used by the admin to create slots).
 */
export function WeekCalendar({
  anchor,
  onAnchorChange,
  renderDay,
  onRangeSelect,
  legend,
  range = DEFAULT_RANGE,
}: {
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  renderDay: (day: Date) => React.ReactNode;
  /**
   * Drag (or click) an empty area to pick a time span. Minutes are past
   * midnight and snapped; a plain click yields a one-hour span.
   */
  onRangeSelect?: (day: Date, startMinutes: number, endMinutes: number) => void;
  legend?: React.ReactNode;
  /** Visible hour window — widened by callers so no slot falls outside. */
  range?: HourRange;
}) {
  const days = weekDaysFor(anchor);
  const hours = hoursOfDay(range);
  const today = new Date();
  const [drag, setDrag] = useState<{
    day: Date;
    fromMin: number;
    toMin: number;
  } | null>(null);

  /** Pointer Y within a day column → snapped minutes past midnight. */
  function minutesAt(clientY: number, el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    const raw = ((clientY - rect.top) / HOUR_PX + range.start) * 60;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.min(Math.max(snapped, range.start * 60), range.end * 60);
  }
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">
          {format(days[0], "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => onAnchorChange(addDays(anchor, -7))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAnchorChange(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => onAnchorChange(addDays(anchor, 7))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {legend}
      </div>

      {/* fixed width — the whole week always fits, no inner scrollbars */}
      <div className="overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
        <div>
          {/* day headers */}
          <div className="grid grid-cols-[2.25rem_repeat(7,1fr)] border-b border-border/60 bg-muted/30 sm:grid-cols-[3rem_repeat(7,1fr)]">
            <div />
            {days.map((day) => {
              const isToday = sameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className="border-l border-border/60 px-0.5 py-2.5 text-center"
                >
                  <p className="text-[10px] font-semibold text-muted-foreground sm:text-xs">
                    {format(day, "EEE")}
                  </p>
                  <p
                    className={cn(
                      "mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                      isToday && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* time grid */}
          <div className="grid grid-cols-[2.25rem_repeat(7,1fr)] sm:grid-cols-[3rem_repeat(7,1fr)]">
            {/* gutter */}
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_PX }}
                  className="relative border-b border-border/40"
                >
                  <span className="absolute -top-2 right-1 text-[9px] font-semibold text-muted-foreground sm:text-[10px]">
                    {format(new Date(2000, 0, 1, h), "h")}
                    <span className="hidden sm:inline">
                      {format(new Date(2000, 0, 1, h), " a")}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            {/* day columns */}
            {days.map((day) => {
              const isPastDay = day < startOfToday;
              return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-l border-border/60",
                  isPastDay && "bg-muted/40",
                  onRangeSelect && !isPastDay && "cursor-crosshair touch-none"
                )}
                onPointerDown={(e) => {
                  if (!onRangeSelect || isPastDay) return;
                  // Let clicks on an existing slot card open that card instead.
                  if ((e.target as HTMLElement).closest("[data-slot-card]")) return;
                  const m = minutesAt(e.clientY, e.currentTarget);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ day, fromMin: m, toMin: m });
                }}
                onPointerMove={(e) => {
                  if (!drag || !sameDay(drag.day, day)) return;
                  setDrag({ ...drag, toMin: minutesAt(e.clientY, e.currentTarget) });
                }}
                onPointerUp={() => {
                  if (!drag || !sameDay(drag.day, day)) return;
                  const a = Math.min(drag.fromMin, drag.toMin);
                  const b = Math.max(drag.fromMin, drag.toMin);
                  setDrag(null);
                  // A tap with no movement means "one hour starting here".
                  onRangeSelect?.(day, a, b > a ? b : a + 60);
                }}
                onPointerCancel={() => setDrag(null)}
              >
                {hours.map((h) => {
                  // past cells are shaded and can't be clicked
                  const cellPast =
                    isPastDay ||
                    (sameDay(day, today) &&
                      h < today.getHours());
                  return (
                    <div
                      key={h}
                      style={{ height: HOUR_PX }}
                      className={cn(
                        "border-b border-border/40",
                        cellPast && "bg-muted/30",
                        onRangeSelect &&
                          !cellPast &&
                          "transition-colors hover:bg-primary/5"
                      )}
                    />
                  );
                })}

                {/* live preview of the span being dragged */}
                {drag && sameDay(drag.day, day) && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-30 rounded-lg border-2 border-dashed border-primary bg-primary/20 px-1 py-0.5 text-[10px] font-bold text-primary"
                    style={{
                      top:
                        (Math.min(drag.fromMin, drag.toMin) / 60 - range.start) *
                        HOUR_PX,
                      height: Math.max(
                        (Math.abs(drag.toMin - drag.fromMin) / 60) * HOUR_PX,
                        18
                      ),
                    }}
                  >
                    {timeFromMinutes(Math.min(drag.fromMin, drag.toMin))}
                    {drag.toMin !== drag.fromMin &&
                      `–${timeFromMinutes(Math.max(drag.fromMin, drag.toMin))}`}
                  </div>
                )}
                {/* slot cards re-enable pointer events on themselves;
                    overflow-hidden keeps any stray card inside the grid */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {renderDay(day)}
                </div>
                {/* "now" line */}
                {sameDay(day, today) &&
                  today.getHours() >= range.start &&
                  today.getHours() < range.end && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-20 border-t-2 border-red-500"
                      style={{
                        top:
                          (today.getHours() +
                            today.getMinutes() / 60 -
                            range.start) *
                          HOUR_PX,
                      }}
                    >
                      <span className="absolute -top-1.5 -left-1 size-3 rounded-full bg-red-500" />
                    </div>
                  )}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
