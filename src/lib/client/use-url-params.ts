"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Helper for filter/search/view controls that live in the URL. `update` merges
 * the given changes into the current query string (null/"" clears a key) and
 * always resets pagination so a new filter starts on page 1.
 */
export function useUrlParams() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [sp, pathname, router]
  );

  return { sp, update };
}
