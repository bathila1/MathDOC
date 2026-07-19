import { z } from "zod";

/**
 * Uniform result type for server actions so client forms can show
 * friendly top-level and per-field error messages.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(
  error: string,
  fieldErrors?: Record<string, string>
): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

/** Convert a ZodError into { ok:false } with per-field friendly messages. */
export function fromZodError<T = undefined>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    error: "Please fix the highlighted fields and try again.",
    fieldErrors,
  };
}
