import { requireStudent } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { StudentNav } from "@/components/site/StudentNav";
import { StudentMain } from "@/components/site/StudentMain";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireStudent();
  if (!profile.profile_completed) redirect("/register");

  return (
    <div className="flex min-h-screen flex-col">
      <StudentNav />
      <StudentMain>{children}</StudentMain>
    </div>
  );
}
