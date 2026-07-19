import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/server/auth";
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
import { format } from "date-fns";
import { CheckCircle2, MessageSquareText } from "lucide-react";
import { smsConfigured } from "@/lib/server/sms";
import { buildBookingSms } from "@/features/booking/server/sms";

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

  // Until SMSLenz is connected, show what the SMS would have said.
  const smsPreview = smsConfigured()
    ? null
    : await buildBookingSms(appt, slot, invoice?.public_token ?? null);

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <CheckCircle2 className="mx-auto size-16 text-green-600" />
      <Card>
        <CardHeader>
          <CardTitle>Your session is booked! 🎉</CardTitle>
          <CardDescription>
            We&apos;ve sent all the details to your phone by SMS.
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
          {invoice && (
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
      {smsPreview && (
        <Card className="border-amber-400 bg-amber-50 text-left dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquareText className="size-4" />
              SMS preview (simulated — SMS gateway not connected yet)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm">{smsPreview}</pre>
          </CardContent>
        </Card>
      )}
      <Button render={<Link href="/student" />}>Go to my dashboard</Button>
    </div>
  );
}
