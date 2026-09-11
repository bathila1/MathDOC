import { AuthSplit } from "@/components/site/AuthSplit";
import { SignUpForm } from "@/features/auth/client/SignUpForm";
import { redirectIfSignedIn } from "@/lib/server/auth";

export const metadata = { title: "Create your account" };

export default async function SignUpPage() {
  await redirectIfSignedIn();

  return (
    <AuthSplit>
      <SignUpForm />
    </AuthSplit>
  );
}
