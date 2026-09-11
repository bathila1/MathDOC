import { createSupabaseServer } from "@/lib/server/supabase";
import { withAdmin } from "@/lib/server/auth";
import { getAllSurveyQuestions } from "@/features/survey/server/queries";
import { AdminSurveyQuestions } from "@/features/survey/client/AdminSurveyQuestions";
import { AdminDefaultTasks } from "@/features/tasks/client/AdminDefaultTasks";
import type { DefaultTask } from "@/lib/shared/types";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Survey questions" };

export default async function AdminSurveyPage() {
  const supabase = await createSupabaseServer();

  // withAdmin runs the guard and these queries together instead of one after
  // the other — see lib/server/auth.ts. Everything below is RLS-scoped.
  const [questions, { data: templates }] = await withAdmin(() =>
    Promise.all([
      getAllSurveyQuestions(),
      supabase
        .from("default_tasks")
        .select("*")
        .order("sort_order", { ascending: true }),
    ])
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Survey questions</h1>
          <p className="text-sm text-muted-foreground">
            Students answer these every time they book a session. Their previous
            answers are pre-filled, so you see what has changed since last time
            — put anything you want to track over time (study hours, for
            instance) in as a <strong>Number</strong> question.
          </p>
        </div>
        <AdminSurveyQuestions questions={questions} />
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
