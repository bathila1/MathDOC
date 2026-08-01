"use client";

import { useUrlParams } from "@/lib/client/use-url-params";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cards ↔ list switch, stored in the `view` URL param. `defaultView` sets which
 *  one is shown when the param is absent (so it isn't written to the URL). */
export function ViewToggle({
  defaultView = "cards",
}: {
  defaultView?: "cards" | "list";
}) {
  const { sp, update } = useUrlParams();
  const raw = sp.get("view");
  const view = raw === "cards" || raw === "list" ? raw : defaultView;
  const options = [
    { value: "cards", label: "Cards", Icon: LayoutGrid },
    { value: "list", label: "List", Icon: List },
  ] as const;

  return (
    <div className="inline-flex shrink-0 rounded-full bg-muted/60 p-1 ring-1 ring-border/50">
      {options.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          aria-label={`${label} view`}
          aria-pressed={view === v}
          onClick={() => update({ view: v === defaultView ? null : v })}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full transition-colors",
            view === v
              ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
