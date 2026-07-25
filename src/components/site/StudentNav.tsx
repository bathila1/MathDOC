"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { LogoutButton } from "@/features/auth/client/LogoutButton";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  CircleUser,
} from "lucide-react";

const items = [
  { href: "/student", label: "My plan", icon: LayoutDashboard, exact: true },
  { href: "/student/book", label: "Book", icon: CalendarClock },
  { href: "/student/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/student/profile", label: "Profile", icon: CircleUser },
];

/** Airy, pill-style top navigation for the student area. */
export function StudentNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/student" className="shrink-0" aria-label="MathDOC home">
          <Logo iconClassName="size-8" textClassName="text-lg" />
        </Link>

        {/* Desktop: one soft pill group with a raised active tab */}
        <nav className="hidden items-center gap-1 rounded-full bg-muted/60 p-1 ring-1 ring-border/50 md:flex">
          {items.map((it) => {
            const active = isActive(it.href, it.exact);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-card text-primary shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <it.icon className="size-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      {/* Mobile: horizontally scrollable pills under the bar */}
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const active = isActive(it.href, it.exact);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "bg-muted/60 text-muted-foreground"
              )}
            >
              <it.icon className="size-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
