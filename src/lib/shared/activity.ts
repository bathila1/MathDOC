// Pure helper for categorising a student by their login recency and progress.

export type ActivityStatus = "active" | "partial" | "inactive";

/**
 * Rules:
 *  - inactive: never logged in, or no login for 30+ days
 *  - active:   logged in within 7 days AND making progress (or no tasks yet)
 *  - partial:  everything else (logging in occasionally, or not progressing)
 */
export function activityStatus(
  lastLoginAt: string | null,
  approved: number,
  total: number
): ActivityStatus {
  if (!lastLoginAt) return "inactive";
  const days =
    (new Date().getTime() - new Date(lastLoginAt).getTime()) / 86_400_000;
  if (days > 30) return "inactive";
  if (days <= 7 && (total === 0 || approved > 0)) return "active";
  return "partial";
}

export const ACTIVITY_META: Record<
  ActivityStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Active", variant: "default" },
  partial: { label: "Partially active", variant: "secondary" },
  inactive: { label: "Inactive", variant: "outline" },
};
