"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Spinner shown on the exact nav item while its navigation is pending. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
  ) : null;
}

/** A Link that shows an inline spinner the instant it's clicked. */
export function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      {children}
      <Pending />
    </Link>
  );
}
