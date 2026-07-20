import { redirect } from "next/navigation";
import { AuthSplit } from "@/components/site/AuthSplit";
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
    <AuthSplit>
      <OtpVerifyForm phone={phone} />
    </AuthSplit>
  );
}
