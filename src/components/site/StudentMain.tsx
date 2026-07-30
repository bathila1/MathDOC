"use client";

import { useContentWidth } from "@/lib/client/content-width";
import { cn } from "@/lib/utils";

/**
 * Student-area <main>. Its max width follows the user's saved preference
 * (normal vs wide), so the "stretched mode" toggle on the profile page changes
 * every student page. The width animates so switching feels intentional.
 */
export function StudentMain({ children }: { children: React.ReactNode }) {
  const { width } = useContentWidth();
  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 px-4 py-8 transition-[max-width] duration-300 ease-out sm:px-6 sm:py-10",
        width === "wide" ? "max-w-[110rem]" : "max-w-6xl"
      )}
    >
      {children}
    </main>
  );
}
