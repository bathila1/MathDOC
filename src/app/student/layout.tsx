import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/features/auth/client/LogoutButton";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

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
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" render={<Link href="/student" />}>
              My plan
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/student/book" />}>
              Book a session
            </Button>
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
