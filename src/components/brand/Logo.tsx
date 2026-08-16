import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * MathDOC logo.
 *
 * The artwork is a COMPLETE lockup — the gradient tile already contains the
 * "MathDOC" wordmark — so this renders the image alone. Pairing it with a
 * separate text wordmark, as the old SVG mark did, would print the name twice.
 *
 * Served from /public as a 512×512 WebP (12.6 KB, down from a 184 KB JPEG). It
 * appears on every page, so it is deliberately a local asset rather than a
 * hotlink: no third-party host on the critical path, and it can be cached and
 * optimised by Next.
 */

export function LogoIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.webp"
      alt="MathDOC"
      width={160}
      height={160}
      // The largest place it renders is size-20 (80px), so cap the candidate
      // widths there. Without this, Next sized the srcSet off the 512px
      // intrinsic dimensions and shipped a 1080px render for a 48px mark.
      sizes="80px"
      // Above the fold in every header — skip lazy loading so it doesn't pop in.
      priority
      className={cn("size-9 rounded-lg object-cover", className)}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return <LogoIcon className={className} />;
}
