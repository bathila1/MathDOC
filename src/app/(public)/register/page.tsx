import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth";
import { ProfileForm } from "@/features/students/client/ProfileForm";

export const metadata = { title: "Register" };

export default async function RegisterPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.profile.role === "admin") redirect("/admin");
  if (auth.profile.profile_completed) redirect("/student");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <ProfileForm />
    </main>
  );
}
