"use client";

import { useState } from "react";

const RISEUP_LOGO_URL =
  "https://raw.githubusercontent.com/bathila1/web-assets/refs/heads/main/IMG-20260816-WA0006.webp";

/**
 * "riseup" company mark for the footer credit.
 *
 * The source is a 500×500 square with the wordmark floating in the middle third
 * and wide white padding around it, so the box is set to the wordmark's own
 * ~3:1 ratio and `object-cover` crops that padding off — sizing by height alone
 * would shrink the wordmark to nothing.
 *
 * It's solid black on solid white with no alpha channel, which lands seamlessly
 * on the white footer; `dark:invert` flips it to white-on-black in dark mode
 * instead of leaving a glaring white tile. Falls back to a text wordmark if the
 * image can't load.
 */
export function RiseupMark() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="font-heading font-extrabold lowercase tracking-tight">
        r<span className="text-primary">i</span>seup
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={RISEUP_LOGO_URL}
      alt="riseup"
      width={72}
      height={24}
      loading="lazy"
      className="h-6 w-18 object-cover dark:invert"
      onError={() => setFailed(true)}
    />
  );
}
