/**
 * What the "clear data" tool in Settings is allowed to erase.
 *
 * Deliberately NOT included, because they are configuration rather than data —
 * wiping them would leave the site broken rather than empty:
 *   settings          (payments toggle, home-page content, notification prefs)
 *   survey_questions  (the questions Sir wrote)
 *   default_tasks     (task templates)
 *   the teacher's own account
 */
export const CLEAR_SCOPES = [
  {
    key: "tasks",
    label: "Tasks & proof submissions",
    detail:
      "Every task assigned to every student, their uploaded proofs, task chat and your private task notes.",
  },
  {
    key: "appointments",
    label: "Appointments & invoices",
    detail:
      "All bookings past and future, and their invoices. Frees up the time slots again.",
  },
  {
    key: "slots",
    label: "Availability times",
    detail: "Every free time on your calendar. Booked times are kept.",
  },
  {
    key: "survey",
    label: "Survey answers",
    detail:
      "Students' answers over time. The questions themselves are kept.",
  },
  {
    key: "notes",
    label: "Session & private notes",
    detail: "Notes written during sessions and your private student notes.",
  },
  {
    key: "certificates",
    label: "Certificates",
    detail: "Issued certificates and their public links.",
  },
  {
    key: "notifications",
    label: "Notifications",
    detail: "In-app notifications and browser push registrations.",
  },
  {
    key: "activity",
    label: "Login history",
    detail: "The record of when each student logged in.",
  },
  {
    key: "students",
    label: "Student accounts",
    detail:
      "Deletes the students themselves, and with them everything above. They can no longer log in.",
  },
] as const;

export type ClearScope = (typeof CLEAR_SCOPES)[number]["key"];

export const CLEAR_SCOPE_KEYS = CLEAR_SCOPES.map((s) => s.key) as [
  ClearScope,
  ...ClearScope[],
];

/** Typed into the confirmation box before anything is deleted. */
export const CLEAR_CONFIRM_PHRASE = "DELETE";
