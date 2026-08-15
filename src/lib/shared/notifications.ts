/**
 * Admin-side notification categories, controlled from the Settings "Notification
 * control centre". Each maps to a `notify_admin_<key>` setting (default: on).
 * Student notifications are always delivered and aren't listed here.
 */
export const ADMIN_NOTIFY_TYPES = [
  {
    key: "proof_submitted",
    label: "New proof to review",
    description: "When a student submits work for review.",
  },
  {
    key: "message",
    label: "New chat message",
    description: "When a student messages you about a task.",
  },
  {
    key: "registration",
    label: "New student registration",
    description: "When a student finishes signing up.",
  },
  {
    key: "booking",
    label: "New session booked",
    description: "When a student books a session with you.",
  },
  {
    key: "booking_cancelled",
    label: "Session cancelled",
    description: "When a student cancels their booked session.",
  },
] as const;

export type AdminNotifyType = (typeof ADMIN_NOTIFY_TYPES)[number]["key"];

/** Settings key for an admin notification toggle. */
export function adminNotifyKey(type: string): string {
  return `notify_admin_${type}`;
}
