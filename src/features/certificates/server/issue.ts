import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { sendSms } from "@/lib/server/sms";
import { certificateSms } from "@/features/booking/server/sms";

/**
 * Issue the digital certificate for an appointment's task plan once every
 * task is approved. Safe to call repeatedly — issues at most once.
 */
export async function issueCertificateIfComplete(
  appointmentId: string
): Promise<void> {
  const admin = createSupabaseAdmin();

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, status, student_id")
    .eq("appointment_id", appointmentId);
  if (!tasks?.length) return;
  if (!tasks.every((t) => t.status === "approved")) return;

  const { data: existing } = await admin
    .from("certificates")
    .select("id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (existing) return;

  const { data: cert, error } = await admin
    .from("certificates")
    .insert({
      student_id: tasks[0].student_id,
      appointment_id: appointmentId,
    })
    .select("public_token, student_id")
    .single();
  if (error || !cert) {
    console.error("certificate insert failed:", error?.message);
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", cert.student_id)
    .single();
  if (profile?.phone) {
    await sendSms(profile.phone, certificateSms(cert.public_token));
  }
}
