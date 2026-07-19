/**
 * Sri Lankan phone number helpers.
 * Accepts "0771234567", "+94771234567", "94771234567", "77 123 4567" etc.
 * Canonical storage format: E.164 => "+94771234567"
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  let m = digits.match(/^(?:\+94|0094|94)(7\d{8})$/);
  if (!m) m = digits.match(/^0(7\d{8})$/);
  if (!m) m = digits.match(/^(7\d{8})$/);
  if (!m) return null;
  return `+94${m[1]}`;
}

/** "+94771234567" -> "077 123 4567" for display */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+94(7\d{2})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `0${m[1]} ${m[2]} ${m[3]}`;
}

/** SMSLenz wants numbers as 94XXXXXXXXX (no plus). */
export function toSmsLenzContact(e164: string): string {
  return e164.replace(/^\+/, "");
}
