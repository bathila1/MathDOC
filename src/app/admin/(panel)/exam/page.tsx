import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { AdminQuestions } from "@/features/exam/client/AdminQuestions";
import type { McqQuestion } from "@/lib/shared/types";

export const metadata = { title: "Placement exam" };

export default async function AdminExamPage() {
  await requireAdmin();
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("mcq_questions")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Placement exam</h1>
      <AdminQuestions questions={(data ?? []) as McqQuestion[]} />
    </div>
  );
}
