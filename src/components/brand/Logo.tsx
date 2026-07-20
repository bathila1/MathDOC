import { cn } from "@/lib/utils";

/**
 * MathDoc logo, recreated as SVG from the brand image: a white document
 * outline with corner ticks on a red-orange gradient tile.
 * Drop the original file at public/logo.png to use it instead (see README).
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-9", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="md-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e63b2e" />
          <stop offset="0.55" stopColor="#ef5b25" />
          <stop offset="1" stopColor="#f7941d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#md-logo-bg)" />
      {/* document outline with an open corner, like the logo */}
      <path
        d="M22 15 H47 a3 3 0 0 1 3 3 V41 l-7 8 H22"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* left corner ticks */}
      <path d="M14 22 h5 M14 22 v-5" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M14 34 h5 M14 34 v-5" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M14 46 h5 M14 46 v-5" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      {/* "x" as maths spark */}
      <path
        d="M30 27 l8 8 M38 27 l-8 8"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  iconClassName,
  textClassName,
}: {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoIcon className={iconClassName} />
      <span
        className={cn(
          "font-heading text-xl font-bold tracking-tight text-brand-gradient",
          textClassName
        )}
      >
        MathDoc
      </span>
    </span>
  );
}
