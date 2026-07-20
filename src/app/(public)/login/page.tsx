import { AuthSplit } from "@/components/site/AuthSplit";
import { PhoneLoginForm } from "@/features/auth/client/PhoneLoginForm";

export const metadata = { title: "Student login" };

export default function LoginPage() {
  return (
    <AuthSplit>
      <PhoneLoginForm />
    </AuthSplit>
  );
}
