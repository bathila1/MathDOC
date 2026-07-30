/**
 * Human-friendly appointment code (e.g. "3F9A2C") derived from the id.
 * Matches the generated `code` column in migration 011 exactly, so the value
 * shown in the UI is the same one the admin can search by.
 */
export function appointmentCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}
