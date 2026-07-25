import { requireStudent } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { StudentNav } from "@/components/site/StudentNav";

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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
