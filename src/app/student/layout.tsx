import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/features/auth/client/LogoutButton";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { CalendarDays, CircleUser } from "lucide-react";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireStudent();
  if (!profile.profile_completed) redirect("/register");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/student">
            <Logo iconClassName="size-8" textClassName="text-lg" />
          </Link>
          <nav className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" render={<Link href="/student" />}>
              My plan
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/student/book" />}>
              Book
            </Button>
            {/* Plain links, not Tooltip-wrapped Buttons: nesting our Button
                inside a Base UI trigger makes both set `data-slot`, which
                mismatches between server and client and breaks hydration.
                `title` gives the same hover hint natively. */}
            <Link
              href="/student/sessions"
              aria-label="Upcoming sessions"
              title="Upcoming sessions"
              className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted"
            >
              <CalendarDays className="size-5" />
            </Link>
            <Link
              href="/student/profile"
              aria-label="My profile"
              title="My profile"
              className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted"
            >
              <CircleUser className="size-5" />
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
