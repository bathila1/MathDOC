"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The teacher's photo, loaded from /sir.jpg (put the image at public/sir.jpg).
 * Until that file exists, a quiet serif monogram placeholder is shown.
 *
 * Served through next/image rather than a bare <img>: the source file is a
 * 678 KB 684x684 PNG (despite the .jpg name), and it is the largest thing on
 * every login, signup and reset page. Next re-encodes it to WebP/AVIF at the
 * size actually being displayed, which is the difference between a few tens of
 * kilobytes and most of a megabyte on a phone connection.
 */
export function TeacherAvatar({
  className,
  /** Set on the one that is the page's largest element, so it is preloaded. */
  priority = false,
  sizes = "(min-width: 1024px) 63vw, 100vw",
}: {
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
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
    <Image
      src="/sir.jpg"
      alt="Sir — your maths teacher"
      // The file's intrinsic size. Layout comes from `className`; these only
      // tell Next the aspect ratio and cap how large it will ever encode.
      width={684}
      height={684}
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
