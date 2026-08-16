"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useTheme } from "next-themes";
import type { TurnstileAction } from "@/lib/server/turnstile";

/**
 * Cloudflare Turnstile widget.
 *
 * This is only the token *producer*. It stops casual scripted abuse at the
 * door and keeps the SMS bill down, but it is not the security boundary —
 * every token is redeemed server-side in `verifyTurnstile()` before the action
 * does any work, so bypassing this component in the browser gains nothing.
 *
 * Rendered explicitly (rather than via the auto-scan) so we control the
 * lifecycle: tokens are single-use, so a failed submit must reset the widget
 * to mint a fresh one.
 */

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Whether a widget will actually render. NEXT_PUBLIC_* is inlined at build
 * time, so this is a constant in the browser bundle. Forms use it to decide
 * whether to *require* a token before enabling submit — without it, a local
 * dev build with no site key would have a permanently disabled button.
 */
export const turnstileEnabled = Boolean(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
);

export function TurnstileWidget({
  action,
  onToken,
  resetKey = 0,
}: {
  action: TurnstileAction;
  /** Called with a token when solved, or null when it expires / errors. */
  onToken: (token: string | null) => void;
  /** Bump this after a failed submit to mint a fresh single-use token. */
  resetKey?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const { resolvedTheme } = useTheme();

  // Keep the latest callback without making it an effect dependency — an inline
  // arrow from the parent would otherwise tear down and re-render the widget on
  // every keystroke, losing the solved token.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    // resolvedTheme is undefined until next-themes has read the stored choice.
    // Waiting for it matters: rendering with a guessed theme and then
    // re-rendering when the real one arrives would throw away a token the user
    // had already solved.
    if (!ready || !siteKey || !resolvedTheme || !boxRef.current) return;
    if (!window.turnstile) return;

    const id = window.turnstile.render(boxRef.current, {
      sitekey: siteKey,
      action,
      theme: resolvedTheme === "dark" ? "dark" : "light",
      callback: (token) => onTokenRef.current(token),
      // A token is only valid for ~5 minutes; drop it so the form can't submit
      // something the server will reject.
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });
    widgetId.current = id;

    return () => {
      try {
        window.turnstile?.remove(id);
      } catch {
        // Already torn down by a fast unmount — nothing to clean up.
      }
      widgetId.current = null;
    };
  }, [ready, siteKey, action, resolvedTheme, resetKey]);

  // Without a site key there is nothing to render. The server still decides
  // whether that is acceptable (it isn't, in production).
  if (!siteKey) return null;

  return (
    <>
      <Script
        src={SCRIPT_SRC}
        strategy="afterInteractive"
        // onReady (not onLoad) also fires when the script is already cached and
        // the component remounts — e.g. navigating /login → /login/verify.
        onReady={() => setReady(true)}
      />
      <div ref={boxRef} className="flex justify-center [&>*]:mx-auto" />
    </>
  );
}
