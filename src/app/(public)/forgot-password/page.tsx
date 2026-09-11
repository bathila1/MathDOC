import { AuthSplit } from "@/components/site/AuthSplit";
import { ForgotPasswordForm } from "@/features/auth/client/ForgotPasswordForm";
import { redirectIfSignedIn } from "@/lib/server/auth";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // NOT guarded by redirectIfSignedIn when a link just failed: a half-finished
  // recovery can leave a live session, and bouncing them to the dashboard
  // would hide the very error they need to see.
  const linkError =
    error === "link" || error === "link-browser" ? error : null;
  if (!linkError) await redirectIfSignedIn();

  return (
    <AuthSplit>
      <ForgotPasswordForm linkError={linkError} />
    </AuthSplit>
  );
}
