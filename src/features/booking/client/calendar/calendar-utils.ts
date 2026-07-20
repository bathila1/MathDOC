import { addDays, startOfWeek } from "date-fns";

/** Default visible day range of the calendar (08:00 → 20:00). */
export const DEFAULT_START_HOUR = 8;
export const DEFAULT_END_HOUR = 20;
export const HOUR_PX = 44; // pixel height of one hour row

export interface HourRange {
  start: number;
  end: number;
}

export const DEFAULT_RANGE: HourRange = {
  start: DEFAULT_START_HOUR,
  end: DEFAULT_END_HOUR,
};

/**
 * Widen the default window so every slot is visible inside the grid —
 * without this, an early/late slot renders outside the calendar box.
 */
export function rangeForSlots(
  slots: { starts_at: string; ends_at: string }[]
): HourRange {
  let start = DEFAULT_START_HOUR;
  let end = DEFAULT_END_HOUR;
  for (const s of slots) {
    const from = new Date(s.starts_at);
    const to = new Date(s.ends_at);
    start = Math.min(start, from.getHours());
    // round the end hour up so a 21:30 finish still fits
    const endHour = to.getHours() + (to.getMinutes() > 0 ? 1 : 0);
    end = Math.max(end, endHour);
  }
  return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) };
}

export function weekDaysFor(anchor: Date): Date[] {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function hoursOfDay(range: HourRange = DEFAULT_RANGE): number[] {
  return Array.from(
    { length: range.end - range.start },
    (_, i) => range.start + i
  );
}

/** Pixel offset of a timestamp from the top of its day column. */
export function topOf(iso: string, range: HourRange = DEFAULT_RANGE): number {
  const d = new Date(iso);
  return (d.getHours() + d.getMinutes() / 60 - range.start) * HOUR_PX;
}

export function heightOf(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max((ms / 3_600_000) * HOUR_PX, 26);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
