import { addDays, startOfWeek } from "date-fns";

/** Visible day range of the calendar (07:00 → 21:00). */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 21;
export const HOUR_PX = 48; // pixel height of one hour row

export function weekDaysFor(anchor: Date): Date[] {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function hoursOfDay(): number[] {
  return Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i
  );
}

/** Pixel offset of a timestamp from the top of its day column. */
export function topOf(iso: string): number {
  const d = new Date(iso);
  return (d.getHours() + d.getMinutes() / 60 - DAY_START_HOUR) * HOUR_PX;
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
