"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The teacher's photo, loaded from /sir.jpg (put the image at public/sir.jpg).
 * Until that file exists, a quiet serif monogram placeholder is shown.
 */
export function TeacherAvatar({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-secondary text-secondary-foreground",
          className
        )}
        aria-label="Sir"
      >
        <span className="font-heading text-6xl font-bold">S</span>
        <span className="text-xs font-medium tracking-widest uppercase opacity-70">
          add public/sir.jpg
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/sir.jpg"
      alt="Sir — your maths teacher"
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
