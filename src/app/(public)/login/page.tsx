import { AuthSplit } from "@/components/site/AuthSplit";
import { PhoneLoginForm } from "@/features/auth/client/PhoneLoginForm";
import { redirectIfSignedIn } from "@/lib/server/auth";

export const metadata = { title: "Student login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  await redirectIfSignedIn(next);

  return (
    <AuthSplit>
      <PhoneLoginForm />
    </AuthSplit>
  );
}
