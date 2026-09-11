import { format as formatWithPattern } from "date-fns";

/**
 * Every time this app SHOWS is Sri Lankan time.
 *
 * `format()` from date-fns renders in the runtime's timezone. On the server
 * that is whatever the host is set to — UTC on Vercel — so a booking
 * confirmation reading "6:30 AM" was really describing 06:30 UTC, i.e. 12:00
 * noon to the Sri Lankan student reading it. In the browser it is the viewer's
 * own zone, which is right for a student at home and wrong for one abroad.
 *
 * Neither is good enough: the school is in Sri Lanka and every session happens
 * there, so that is the reference zone regardless of where the server, the
 * teacher, or the student happens to be. `formatSchool` below is a drop-in for
 * date-fns `format` that pins the output to it.
 *
 * The ONE thing that stays browser-local is the teacher's calendar, where
 * dragging out a slot has to resolve the instant in the zone the teacher is
 * actually in. See calendar-utils.ts.
 */

export const SCHOOL_TIME_ZONE = "Asia/Colombo";

function partsOf(
  date: Date,
  options: Intl.DateTimeFormatOptions
): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIME_ZONE,
    ...options,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

const WALL_CLOCK_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

/**
 * The instant's Sri Lankan wall clock, returned as a Date whose LOCAL fields
 * hold those values. Feeding that to date-fns makes every pattern — weekday,
 * month name, 12-hour clock — come out in Sri Lankan terms.
 *
 * The resulting Date does not represent the same instant, and must never be
 * sent back to the database or compared against one. It exists purely to be
 * formatted.
 */
function schoolWallClock(value: Date | string | number): Date {
  const d = value instanceof Date ? value : new Date(value);
  const p = partsOf(d, WALL_CLOCK_OPTIONS);
  // Some environments report midnight as hour "24" rather than "00".
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  return new Date(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second)
  );
}

/**
 * Drop-in replacement for date-fns `format`, always in Sri Lankan time.
 *
 * Imported as `import { formatSchool as format } from "@/lib/shared/time"` so
 * that every `format()` call in a file is school time by construction, and
 * nobody has to remember to convert at each call site.
 */
export function formatSchool(
  value: Date | string | number,
  pattern: string
): string {
  return formatWithPattern(schoolWallClock(value), pattern);
}

/**
 * First and last instant of the Sri Lankan day containing `at`, as ISO strings
 * for querying `timestamptz` columns.
 *
 * Without this, "today's sessions" used the SERVER's day. On Vercel that is a
 * UTC day running 05:30 → 05:29 Colombo, so an early-morning session fell into
 * yesterday and vanished from the dashboard.
 */
export function schoolDayRange(at: Date | string = new Date()): {
  start: string;
  end: string;
} {
  const d = typeof at === "string" ? new Date(at) : at;
  const p = partsOf(d, WALL_CLOCK_OPTIONS);
  const hour = p.hour === "24" ? 0 : Number(p.hour);

  // How far Colombo is from UTC right now, derived rather than hardcoded to
  // +5:30 so a future offset change needs no code edit.
  const wallAsUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second)
  );
  const offsetMs = wallAsUtc - Math.floor(d.getTime() / 1000) * 1000;

  const startMs =
    Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) - offsetMs;

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + 24 * 60 * 60 * 1000 - 1).toISOString(),
  };
}

/** "Tue 18 Aug 2026 at 8:00 AM" — for SMS and other server-rendered text. */
export function formatSchoolDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = partsOf(d, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const meridiem = (p.dayPeriod ?? "").toUpperCase();
  return `${p.weekday} ${p.day} ${p.month} ${p.year} at ${p.hour}:${p.minute} ${meridiem}`;
}

/** "18 Aug 2026" — dates only, for invoices and certificates. */
export function formatSchoolDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = partsOf(d, { day: "numeric", month: "short", year: "numeric" });
  return `${p.day} ${p.month} ${p.year}`;
}

/** "8:00 AM" */
export function formatSchoolTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = partsOf(d, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? "").toUpperCase()}`;
}
