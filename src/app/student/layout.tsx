import { requireStudent } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { StudentNav } from "@/components/site/StudentNav";
import { StudentMain } from "@/components/site/StudentMain";
import { StudentNotificationPrompt } from "@/components/site/StudentNotificationPrompt";
import { PushRegistrar } from "@/components/site/PushRegistrar";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireStudent();
  if (!profile.profile_completed) redirect("/register");

  return (
    <div className="flex min-h-screen flex-col">
      <StudentNav userId={user.id} />
      <StudentMain>{children}</StudentMain>
      <StudentNotificationPrompt />
      <PushRegistrar />
    </div>
  );
}
