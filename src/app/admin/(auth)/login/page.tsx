import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AdminLoginForm } from "@/features/auth/client/AdminLoginForm";
import { redirectIfSignedIn } from "@/lib/server/auth";

export const metadata = { title: "Teacher login" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  await redirectIfSignedIn(next);

  return (
    <main className="bg-graph flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <Link href="/">
        <Logo className="size-20" />
      </Link>
      <AdminLoginForm />
    </main>
  );
}
