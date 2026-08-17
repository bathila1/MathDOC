import { addDays, startOfWeek } from "date-fns";

/** Default visible day range of the calendar (08:00 → 20:00). */
export const DEFAULT_START_HOUR = 8;
export const DEFAULT_END_HOUR = 20;
export const HOUR_PX = 56; // pixel height of one hour row (roomier = calmer grid)

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

export interface Positioned<T> {
  slot: T;
  top: number;
  height: number;
  /** Percent offset from the left of the day column. */
  leftPct: number;
  /** Percent width of the day column. */
  widthPct: number;
}

interface TimeSpan {
  starts_at: string;
  ends_at: string;
}

/**
 * Place a day's slots, giving overlapping ones their own side-by-side column
 * the way Google Calendar does.
 *
 * Previously every card was positioned `inset-x-0.5`, so two slots at the same
 * time were drawn exactly on top of each other — the top one simply hid the
 * one underneath. Overlaps should not normally exist (createSlot now rejects
 * them), but when they do the teacher has to be able to SEE them in order to
 * delete one, and a hidden card is also a slot a student can't discover.
 */
export function layoutDaySlots<T extends TimeSpan>(
  slots: T[],
  range: HourRange = DEFAULT_RANGE
): Positioned<T>[] {
  const sorted = [...slots].sort((a, b) => {
    const d = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    // Longer slot first on a tie, so the wider block takes the left column.
    return d !== 0
      ? d
      : new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime();
  });

  const out: Positioned<T>[] = [];

  // A cluster is a run of slots connected by overlap; column count is decided
  // per cluster so one busy hour doesn't shrink the whole day.
  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;

    // Greedy column packing: reuse the first column that has already finished.
    const columnEnds: number[] = [];
    const columnOf = new Map<T, number>();

    for (const s of cluster) {
      const start = new Date(s.starts_at).getTime();
      const end = new Date(s.ends_at).getTime();
      let col = columnEnds.findIndex((e) => e <= start);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[col] = end;
      }
      columnOf.set(s, col);
    }

    const cols = columnEnds.length;
    for (const s of cluster) {
      out.push({
        slot: s,
        top: topOf(s.starts_at, range),
        height: heightOf(s.starts_at, s.ends_at),
        leftPct: ((columnOf.get(s) ?? 0) * 100) / cols,
        widthPct: 100 / cols,
      });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const s of sorted) {
    const start = new Date(s.starts_at).getTime();
    if (cluster.length > 0 && start >= clusterEnd) flush();
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, new Date(s.ends_at).getTime());
  }
  flush();

  return out;
}
