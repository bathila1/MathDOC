import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import type { Certificate } from "@/lib/shared/types";

export interface CertificateView {
  certificate: Certificate;
  studentName: string;
  taskCount: number;
  planTitle: string;
}

/** Public certificate lookup by unguessable token (service role). */
export async function getCertificateByToken(
  token: string
): Promise<CertificateView | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("certificates")
    .select("*, profiles(full_name)")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;

  const { profiles, ...certificate } = data as Certificate & {
    profiles: { full_name: string | null };
  };

  const { data: tasks } = await admin
    .from("tasks")
    .select("title")
    .eq("appointment_id", certificate.appointment_id)
    .order("sort_order", { ascending: true });

  return {
    certificate: certificate as Certificate,
    studentName: profiles?.full_name ?? "Student",
    taskCount: tasks?.length ?? 0,
    planTitle: "Personal Improvement Plan",
  };
}
