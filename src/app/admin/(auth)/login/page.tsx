import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AdminLoginForm } from "@/features/auth/client/AdminLoginForm";

export const metadata = { title: "Teacher login" };

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary/10 to-transparent p-4">
      <Link href="/">
        <Logo iconClassName="size-12" textClassName="text-2xl" />
      </Link>
      <AdminLoginForm />
    </main>
  );
}
