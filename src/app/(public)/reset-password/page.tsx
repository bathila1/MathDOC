import { redirect } from "next/navigation";
import { AuthSplit } from "@/components/site/AuthSplit";
import { ResetPasswordForm } from "@/features/auth/client/ResetPasswordForm";
import { createSupabaseServer } from "@/lib/server/supabase";
import { hasResetGrant } from "@/lib/server/password-reset";

export const metadata = { title: "Set a new password" };

/**
 * Deliberately NOT guarded by `redirectIfSignedIn` — arriving here always
 * means a live session, because the recovery link created one. The gate that
 * matters is the signed grant, which only /auth/recovery issues and only after
 * verifying a genuine recovery token.
 *
 * The grant is checked against THIS session's user, so one that was issued for
 * a different account is no use here either.
 */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await hasResetGrant(user.id))) redirect("/forgot-password");

  return (
    <AuthSplit>
      <ResetPasswordForm />
    </AuthSplit>
  );
}
