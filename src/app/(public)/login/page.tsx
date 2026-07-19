import { PhoneLoginForm } from "@/features/auth/client/PhoneLoginForm";

export const metadata = { title: "Student login" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <PhoneLoginForm />
    </main>
  );
}
