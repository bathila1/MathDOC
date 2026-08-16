"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { LogoutButton } from "@/features/auth/client/LogoutButton";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { NotificationBell } from "@/components/site/NotificationBell";
import { MobileMenu } from "@/components/site/MobileMenu";
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

/** Airy, edge-to-edge top navigation for the student area. */
export function StudentNav({ userId }: { userId: string }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      {/* Full width: logo pinned to the far-left, actions to the far-right */}
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/student" className="shrink-0" aria-label="MathDOC home">
          <Logo className="size-11" />
        </Link>

        {/* Desktop: centred pill group with a raised active tab */}
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
          <NotificationBell userId={userId} />
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
          {/* Mobile: hamburger → slide-in menu with the same links + logout */}
          <div className="md:hidden">
            <MobileMenu title="MathDOC">
              {items.map((it) => {
                const active = isActive(it.href, it.exact);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <it.icon className="size-4" />
                    {it.label}
                  </Link>
                );
              })}
              <div className="mt-2 border-t border-border/60 pt-2">
                <LogoutButton />
              </div>
            </MobileMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
