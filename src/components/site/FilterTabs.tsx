import Link from "next/link";
import { cn } from "@/lib/utils";

export interface FilterOption {
  /** "all" is special-cased to link to the bare basePath (no query param). */
  value: string;
  label: string;
  count?: number;
}

/**
 * Server-rendered filter pills (plain links, no client JS). Selecting a filter
 * navigates to `?param=value`, which resets pagination to page 1.
 */
export function FilterTabs({
  options,
  active,
  basePath,
  paramName = "status",
}: {
  options: FilterOption[];
  active: string;
  basePath: string;
  paramName?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isActive = o.value === active;
        const href =
          o.value === "all"
            ? basePath
            : `${basePath}?${paramName}=${encodeURIComponent(o.value)}`;
        return (
          <Link
            key={o.value}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground ring-1 ring-border/50 hover:text-foreground"
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  isActive ? "bg-primary-foreground/20" : "bg-foreground/10"
                )}
              >
                {o.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
