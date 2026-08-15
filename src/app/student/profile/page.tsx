import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { ProfileDetailsCard } from "@/features/students/client/ProfileDetailsCard";
import { ContentWidthToggle } from "@/components/site/ContentWidthToggle";
import { NotificationStatusAlert } from "@/components/site/NotificationStatusAlert";
import type {
  Appointment,
  AvailabilitySlot,
  Certificate,
  SessionNote,
} from "@/lib/shared/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/site/BackLink";
import { appointmentCode } from "@/lib/shared/appointments";
import { format } from "date-fns";
import { formatPhone } from "@/lib/shared/phone";
import { Award, ChevronRight } from "lucide-react";

export const metadata = { title: "My profile" };

type ApptRow = Appointment & { availability_slots: AvailabilitySlot };

export default async function ProfilePage() {
  const { user, profile } = await requireStudent();
  const supabase = await createSupabaseServer();

  const [apptRes, certRes, noteRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, availability_slots(*)")
      .eq("student_id", user.id),
    supabase
      .from("certificates")
      .select("*")
      .eq("student_id", user.id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("session_notes")
      .select("*")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const past = ((apptRes.data ?? []) as ApptRow[])
    .filter(
      (a) =>
        a.status === "completed" ||
        (a.status !== "cancelled" &&
          new Date(a.availability_slots.ends_at) <= new Date())
    )
    .sort(
      (a, b) =>
        new Date(b.availability_slots.starts_at).getTime() -
        new Date(a.availability_slots.starts_at).getTime()
    );
  const certificates = (certRes.data ?? []) as Certificate[];
  const notes = (noteRes.data ?? []) as SessionNote[];
  const apptById = new Map(
    ((apptRes.data ?? []) as ApptRow[]).map((a) => [a.id, a])
  );

  const details: [string, string | null][] = [
    ["Full name", profile.full_name],
    ["Phone", profile.phone ? formatPhone(profile.phone) : null],
    ["School", profile.school],
    ["Grade / Year", profile.grade],
    ["Guardian", profile.guardian_name],
    [
      "Guardian phone",
      profile.guardian_phone ? formatPhone(profile.guardian_phone) : null,
    ],
    ["Address", profile.address],
    [
      "Placement quiz",
      profile.mcq_score != null
        ? `${profile.mcq_score} / ${profile.mcq_total}`
        : null,
    ],
    ["Category", profile.category],
  ];

  return (
    <div className="space-y-6">
      <BackLink href="/student" label="My plan" />

      <div>
        <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
          About me
        </p>
        <h1 className="mt-1 text-3xl">My profile</h1>
      </div>

      <NotificationStatusAlert />

      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Choose how wide pages appear on large screens.
          </p>
          <ContentWidthToggle />
        </CardContent>
      </Card>

      {/* Editing happens in place — no trip back to the register page */}
      <ProfileDetailsCard
        readOnlyRows={details}
        values={{
          full_name: profile.full_name,
          school: profile.school,
          grade: profile.grade,
          guardian_name: profile.guardian_name,
          guardian_phone: profile.guardian_phone,
          address: profile.address,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Notes from Sir</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Notes Sir writes during your sessions will appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => {
                const from = apptById.get(n.appointment_id);
                return (
                  <li key={n.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line">{n.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(n.created_at), "d MMM yyyy")}
                        {from &&
                          ` · session #${appointmentCode(from.id)} on ${format(
                            new Date(from.availability_slots.starts_at),
                            "d MMM"
                          )}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sessions completed yet.
            </p>
          ) : (
            past.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{appointmentCode(a.id)}
                    </span>{" "}
                    {format(
                      new Date(a.availability_slots.starts_at),
                      "EEE d MMM yyyy, h:mm a"
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {a.mode === "online" ? "Online" : "In person"}
                    {a.is_follow_up && " · Follow-up"}
                  </p>
                  {a.diagnosis_notes && (
                    <div className="mt-2 rounded-md bg-muted/50 p-2">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Sir&apos;s diagnosis
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm">
                        {a.diagnosis_notes}
                      </p>
                    </div>
                  )}
                </div>
                <Badge variant="secondary" className="capitalize">
                  {a.status === "completed" ? "Completed" : "Finished"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My certificates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Finish all the tasks in a plan to earn your first certificate.
            </p>
          ) : (
            certificates.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="w-full justify-between"
                render={<Link href={`/certificate/${c.public_token}`} />}
              >
                <span className="flex items-center gap-2">
                  <Award className="size-4 text-primary" />
                  Certificate — {format(new Date(c.issued_at), "d MMM yyyy")}
                </span>
                <ChevronRight className="size-4" />
              </Button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
