"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useHydrated } from "./browser";

/**
 * Student-area content width preference ("normal" vs "wide"), remembered in
 * localStorage and synced across components/tabs. Toggled from the profile page,
 * read by the <StudentMain> wrapper.
 */
export type ContentWidth = "normal" | "wide";

const KEY = "mathdoc-content-width";
const EVENT = "mathdoc-content-width-change";

function read(): ContentWidth {
  if (typeof window === "undefined") return "normal";
  // Normal is the default; only an explicit "wide" choice stretches it.
  return window.localStorage.getItem(KEY) === "wide" ? "wide" : "normal";
}

/**
 * localStorage is the store; `storage` covers other tabs and our own custom
 * event covers other components in this one (storage does not fire on the tab
 * that wrote the value).
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useContentWidth() {
  // read() returns a string, so React's snapshot comparison is by value and
  // cannot loop — no memoisation needed.
  const width = useSyncExternalStore(subscribe, read, () => "normal" as const);
  const mounted = useHydrated();

  const setWidth = useCallback((w: ContentWidth) => {
    window.localStorage.setItem(KEY, w);
    // Notify this tab's subscribers; the store read above picks up the value.
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { width, setWidth, mounted };
}
