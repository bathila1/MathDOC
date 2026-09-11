import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/server/auth";
import { getPaymentsEnabled, getSmsEnabled } from "@/lib/server/settings";
import { createSupabaseServer } from "@/lib/server/supabase";
import type {
  Appointment,
  AvailabilitySlot,
  Invoice,
} from "@/lib/shared/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatSchool as format } from "@/lib/shared/time";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Booking confirmed" };

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireStudent();
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("appointments")
    .select("*, availability_slots(*), invoices(*)")
    .eq("id", id)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const appt = data as Appointment & {
    availability_slots: AvailabilitySlot;
    invoices: Invoice[];
  };
  const invoice = Array.isArray(appt.invoices) ? appt.invoices[0] : appt.invoices;
  const slot = appt.availability_slots;
  // The invoice is meaningless until the payment gateway is live, so the
  // link only appears once payments are switched on in admin Settings.
  // Likewise the SMS line: while sending is off nothing is texted, and
  // promising a message that will never arrive is how a student ends up
  // waiting for it instead of reading the details right here.
  const [paymentsEnabled, smsEnabled] = await Promise.all([
    getPaymentsEnabled(),
    getSmsEnabled(),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <CheckCircle2 className="mx-auto size-16 text-green-600" />
      <Card>
        <CardHeader>
          <CardTitle>Your session is booked! 🎉</CardTitle>
          <CardDescription>
            {smsEnabled
              ? "We've sent all the details to your phone by SMS."
              : "Here are the details — you'll also find them on your dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-lg font-semibold">
            {format(new Date(slot.starts_at), "EEEE, d MMMM yyyy")}
          </p>
          <p className="text-lg">
            {format(new Date(slot.starts_at), "h:mm a")} –{" "}
            {format(new Date(slot.ends_at), "h:mm a")}
          </p>
          <p className="capitalize text-muted-foreground">
            {appt.mode === "online"
              ? "Online — Sir will share the meeting link"
              : "In person"}
          </p>
          {paymentsEnabled && invoice && (
            <Button
              variant="outline"
              className="mt-4"
              render={<Link href={`/invoice/${invoice.public_token}`} target="_blank" />}
            >
              View your invoice
            </Button>
          )}
        </CardContent>
      </Card>
      <Button render={<Link href="/student" />}>Go to my dashboard</Button>
    </div>
  );
}
