import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { AdminQuestions } from "@/features/exam/client/AdminQuestions";
import { AdminDefaultTasks } from "@/features/tasks/client/AdminDefaultTasks";
import { getDownloadUrl } from "@/lib/server/files";
import type { DefaultTask, McqQuestion } from "@/lib/shared/types";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Placement exam" };

export default async function AdminExamPage() {
  await requireAdmin();
  const supabase = await createSupabaseServer();
  const [{ data: questions }, { data: templates }] = await Promise.all([
    supabase
      .from("mcq_questions")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("default_tasks")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  // Question pictures live in the private bucket — presign each for preview.
  const qRows = (questions ?? []) as McqQuestion[];
  const imageUrls: Record<string, string> = {};
  await Promise.all(
    qRows
      .filter((q) => q.image_key)
      .map(async (q) => {
        imageUrls[q.id] = await getDownloadUrl(q.image_key!);
      })
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Placement exam</h1>
          <p className="text-sm text-muted-foreground">
            Questions students answer when they register.
          </p>
        </div>
        <AdminQuestions questions={qRows} imageUrls={imageUrls} />
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Default tasks</h2>
          <p className="text-sm text-muted-foreground">
            Templates you can quickly assign to any student.
          </p>
        </div>
        <AdminDefaultTasks templates={(templates ?? []) as DefaultTask[]} />
      </section>
    </div>
  );
}
