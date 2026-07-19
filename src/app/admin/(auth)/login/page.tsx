import { AdminLoginForm } from "@/features/auth/client/AdminLoginForm";

export const metadata = { title: "Teacher login" };

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <AdminLoginForm />
    </main>
  );
}
