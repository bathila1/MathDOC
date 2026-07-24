"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Global top loading bar (GitHub/YouTube style). Appears the instant a
 * same-origin link is clicked and finishes when the new route renders, so
 * navigation always gives immediate feedback even while the server responds.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setSlow(false);
    setWidth(100);
    timers.current.push(setTimeout(() => setVisible(false), 250));
    timers.current.push(setTimeout(() => setWidth(0), 550));
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setVisible(true);
    setSlow(false);
    setWidth(8);
    // creep slowly toward 90% (never reaching it) until the route resolves
    timers.current.push(
      setTimeout(() => {
        setSlow(true);
        setWidth(90);
      }, 60)
    );
    // safety: never get stuck on
    timers.current.push(setTimeout(finish, 10000));
  }, [clearTimers, finish]);

  // Start the bar the moment a same-origin navigation link is clicked.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        a.target === "_blank" ||
        a.hasAttribute("download")
      )
        return;
      let url: URL;
      try {
        url = new URL(a.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page → no navigation, don't show the bar
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      start();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  // Finish when the route actually changes (skip the initial mount).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    finish();
  }, [pathname, finish]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[200]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-[3px] bg-primary shadow-md shadow-primary/60"
        style={{
          width: `${width}%`,
          transition: slow
            ? "width 10s cubic-bezier(0.1, 0.9, 0.2, 1)"
            : "width 250ms ease-out",
        }}
      />
    </div>
  );
}
