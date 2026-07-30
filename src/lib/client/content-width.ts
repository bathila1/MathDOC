"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Student-area content width preference ("normal" vs "wide"), remembered in
 * localStorage and synced across components/tabs. Toggled from the profile page,
 * read by the <StudentMain> wrapper.
 */
export type ContentWidth = "normal" | "wide";

const KEY = "mathdoc-content-width";
const EVENT = "mathdoc-content-width-change";

function read(): ContentWidth {
  if (typeof window === "undefined") return "wide";
  // Stretched is the default; only an explicit "normal" choice narrows it.
  return window.localStorage.getItem(KEY) === "normal" ? "normal" : "wide";
}

export function useContentWidth() {
  const [width, setWidthState] = useState<ContentWidth>("wide");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWidthState(read());
    const sync = () => setWidthState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setWidth = useCallback((w: ContentWidth) => {
    window.localStorage.setItem(KEY, w);
    setWidthState(w);
    // Notify other subscribers in this tab (storage event only fires cross-tab).
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { width, setWidth, mounted };
}
