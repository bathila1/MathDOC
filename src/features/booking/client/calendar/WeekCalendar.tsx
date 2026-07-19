"use client";

import { addDays } from "date-fns";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAY_START_HOUR,
  HOUR_PX,
  hoursOfDay,
  sameDay,
  weekDaysFor,
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
  onCellClick,
  legend,
}: {
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  renderDay: (day: Date) => React.ReactNode;
  onCellClick?: (day: Date, hour: number) => void;
  legend?: React.ReactNode;
}) {
  const days = weekDaysFor(anchor);
  const hours = hoursOfDay();
  const today = new Date();

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

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <div className="min-w-[860px]">
          {/* day headers */}
          <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b">
            <div />
            {days.map((day) => {
              const isToday = sameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className="border-l px-2 py-2 text-center"
                >
                  <p className="text-xs font-semibold text-muted-foreground">
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
          <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]">
            {/* gutter */}
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_PX }}
                  className="relative border-b border-dashed border-border/60"
                >
                  <span className="absolute -top-2 right-1.5 text-[10px] font-semibold text-muted-foreground">
                    {format(new Date(2000, 0, 1, h), "h a")}
                  </span>
                </div>
              ))}
            </div>
            {/* day columns */}
            {days.map((day) => (
              <div key={day.toISOString()} className="relative border-l">
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{ height: HOUR_PX }}
                    className={cn(
                      "border-b border-dashed border-border/60",
                      onCellClick &&
                        "cursor-pointer transition-colors hover:bg-primary/5"
                    )}
                    onClick={() => onCellClick?.(day, h)}
                  />
                ))}
                {/* slot cards re-enable pointer events on themselves */}
                <div className="pointer-events-none absolute inset-0">
                  {renderDay(day)}
                </div>
                {/* "now" line */}
                {sameDay(day, today) &&
                  today.getHours() >= DAY_START_HOUR && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-20 border-t-2 border-red-500"
                      style={{
                        top:
                          (today.getHours() +
                            today.getMinutes() / 60 -
                            DAY_START_HOUR) *
                          HOUR_PX,
                      }}
                    >
                      <span className="absolute -top-1.5 -left-1 size-3 rounded-full bg-red-500" />
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
