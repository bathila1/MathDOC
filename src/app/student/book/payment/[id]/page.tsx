import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { PaymentPanel } from "@/features/booking/client/PaymentPanel";
import type { Appointment } from "@/lib/shared/types";

export const metadata = { title: "Payment" };

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireStudent();
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const appointment = data as Appointment;
  if (appointment.status !== "pending_payment") {
    redirect(`/student/book/confirmed/${appointment.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Almost there!</h1>
      <PaymentPanel
        appointmentId={appointment.id}
        amount={Number(appointment.price)}
      />
    </div>
  );
}
