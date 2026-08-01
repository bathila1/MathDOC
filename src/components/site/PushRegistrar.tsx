"use client";

import { useEffect } from "react";
import { subscribeToPush } from "@/lib/client/push";

/**
 * Invisible helper: on load, if the user has already allowed notifications, make
 * sure this browser is subscribed to Web Push (registers the SW + saves the
 * subscription). New grants trigger subscribeToPush() from the permission flows.
 */
export function PushRegistrar() {
  useEffect(() => {
    subscribeToPush();
  }, []);
  return null;
}
