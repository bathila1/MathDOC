"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows the teacher's photo from /sir.jpg (drop the image into public/sir.jpg).
 * Falls back to a friendly gradient avatar until the file exists.
 */
export function TeacherAvatar({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-brand-gradient text-5xl",
          className
        )}
        aria-label="Sir"
      >
        🧑‍🏫
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
