import { requireStudent } from "@/lib/server/auth";
import {
  getAttemptForStudent,
  getExamQuestions,
} from "@/features/exam/server/queries";
import { ExamForm } from "@/features/exam/client/ExamForm";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Placement quiz" };

export default async function ExamPage() {
  const { user } = await requireStudent();

  const attempt = await getAttemptForStudent(user.id);
  if (attempt) redirect("/student");

  const questions = await getExamQuestions();
  if (questions.length === 0) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Quiz not ready yet</CardTitle>
          <CardDescription>
            Sir hasn&apos;t published the placement quiz. You can continue to
            your dashboard and come back later.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Placement quiz</h1>
        <p className="text-muted-foreground">
          Answer these {questions.length} questions so Sir knows your level.
          Don&apos;t worry — this is not a test you can fail!
        </p>
      </div>
      <ExamForm questions={questions} />
    </div>
  );
}
