"use client";

import { useState } from "react";

/**
 * "riseup" company mark for the footer credit. Uses /riseup.png when the
 * file exists (drop the logo into public/riseup.png — it's inverted to
 * white for the dark footer); falls back to a text wordmark.
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
      src="/riseup.png"
      alt="riseup"
      className="h-5 w-auto invert"
      onError={() => setFailed(true)}
    />
  );
}
