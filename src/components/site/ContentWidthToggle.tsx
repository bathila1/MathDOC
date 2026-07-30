"use client";

import { useContentWidth, type ContentWidth } from "@/lib/client/content-width";
import { cn } from "@/lib/utils";
import { RectangleHorizontal, StretchHorizontal } from "lucide-react";

const options: { value: ContentWidth; label: string; icon: typeof RectangleHorizontal }[] = [
  { value: "normal", label: "Normal", icon: RectangleHorizontal },
  { value: "wide", label: "Stretched", icon: StretchHorizontal },
];

/** Segmented control for the student content width. Lives on the profile page. */
export function ContentWidthToggle() {
  const { width, setWidth, mounted } = useContentWidth();
  return (
    <div className="inline-flex rounded-full bg-muted/60 p-1 ring-1 ring-border/50">
      {options.map((o) => {
        const active = mounted && width === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setWidth(o.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <o.icon className="size-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
