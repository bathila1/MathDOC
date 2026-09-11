import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth";
import { AuthSplit } from "@/components/site/AuthSplit";
import { ProfileForm } from "@/features/students/client/ProfileForm";

export const metadata = { title: "Register" };

export default async function RegisterPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.profile.role === "admin") redirect("/admin");

  const p = auth.profile;
  return (
    <AuthSplit>
      <ProfileForm
        mode={p.profile_completed ? "edit" : "register"}
        initial={{
          full_name: p.full_name,
          phone: p.phone,
          school: p.school,
          grade: p.grade,
          guardian_name: p.guardian_name,
          guardian_phone: p.guardian_phone,
          address: p.address,
        }}
      />
    </AuthSplit>
  );
}
