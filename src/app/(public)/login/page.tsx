import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { PhoneLoginForm } from "@/features/auth/client/PhoneLoginForm";

export const metadata = { title: "Student login" };

export default function LoginPage() {
  return (
    <main className="bg-graph flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <Link href="/">
        <Logo iconClassName="size-12" textClassName="text-2xl" />
      </Link>
      <PhoneLoginForm />
    </main>
  );
}
