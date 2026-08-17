/**
 * Formatting times for anything produced on the SERVER.
 *
 * `format()` from date-fns renders in the runtime's timezone. In the browser
 * that's the user's zone, which is what we want. On the server it's whatever
 * the host is set to — UTC on Vercel — so an SMS reading "8:00 AM" was really
 * describing 08:00 UTC, i.e. 1:30 PM to the Sri Lankan student receiving it.
 *
 * Server-generated text therefore has to name an explicit timezone. The school
 * is in Sri Lanka and every session happens there, so that is the reference
 * zone regardless of where the server (or Sir) happens to be.
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
