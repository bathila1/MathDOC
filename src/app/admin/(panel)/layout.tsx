import { Suspense } from "react";
import { requireAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { LogoutButton } from "@/features/auth/client/LogoutButton";
import { Logo } from "@/components/brand/Logo";
import { NavLink } from "@/components/site/NavLink";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  CalendarClock,
  CalendarCheck,
  Users,
  FileCheck,
  ClipboardList,
  Activity,
  Settings,
} from "lucide-react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/availability", label: "Availability", icon: CalendarClock },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarCheck },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/proofs", label: "Proof reviews", icon: FileCheck },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/exam", label: "Placement exam", icon: ClipboardList },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen">
      {/* fixed sidebar — never scrolls with the content */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-muted/30 sm:flex">
        <div className="px-4 py-4">
          <Logo iconClassName="size-8" textClassName="text-lg" />
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            Teacher panel
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              <item.icon className="size-4" />
              {item.label}
              {item.href === "/admin/proofs" && (
                <Suspense fallback={null}>
                  <PendingProofsBadge className="ml-auto" />
                </Suspense>
              )}
            </NavLink>
          ))}
        </nav>
        {/* pinned to the bottom-left corner */}
        <div className="flex items-center justify-between border-t p-2">
          <LogoutButton />
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col sm:ml-56">
        <header className="flex items-center justify-between border-b px-4 py-3 sm:hidden">
          <Logo iconClassName="size-7" textClassName="text-base" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-2 py-1 sm:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap hover:bg-muted"
            >
              {item.label}
              {item.href === "/admin/proofs" && (
                <Suspense fallback={null}>
                  <PendingProofsBadge className="ml-1.5" />
                </Suspense>
              )}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Streamed so the count query never delays the panel shell rendering. */
async function PendingProofsBadge({ className }: { className?: string }) {
  const supabase = await createSupabaseServer();
  const { count } = await supabase
    .from("proof_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (!count) return null;
  return <Badge className={className}>{count}</Badge>;
}
