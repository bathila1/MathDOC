import { AuthSplit } from "@/components/site/AuthSplit";
import { EmailLoginForm } from "@/features/auth/client/EmailLoginForm";
import { redirectIfSignedIn } from "@/lib/server/auth";

export const metadata = { title: "Student login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  await redirectIfSignedIn(next);

  return (
    <AuthSplit>
      <EmailLoginForm
        linkError={
          error === "link" || error === "link-browser" ? error : null
        }
      />
    </AuthSplit>
  );
}
