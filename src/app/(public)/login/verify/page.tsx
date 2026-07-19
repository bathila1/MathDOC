import { redirect } from "next/navigation";
import { OtpVerifyForm } from "@/features/auth/client/OtpVerifyForm";

export const metadata = { title: "Enter code" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  if (!phone) redirect("/login");
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <OtpVerifyForm phone={phone} />
    </main>
  );
}
