import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import type {
  Appointment,
  AvailabilitySlot,
  Profile,
} from "@/lib/shared/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { CalendarCheck, CalendarClock, FileCheck, Users } from "lucide-react";

export const metadata = { title: "Dashboard" };

type ApptRow = Appointment & {
  availability_slots: AvailabilitySlot;
  profiles: Pick<Profile, "full_name">;
};

export default async function AdminDashboard() {
  await requireAdmin();
  const supabase = await createSupabaseServer();
  const now = new Date();

  const [todayRes, proofsRes, studentsRes, recentRes, expiringRes] =
    await Promise.all([
    supabase
      .from("appointments")
      .select("*, availability_slots!inner(*), profiles(full_name)")
      .in("status", ["confirmed", "pending_payment"])
      .gte("availability_slots.starts_at", startOfDay(now).toISOString())
      .lte("availability_slots.starts_at", endOfDay(now).toISOString()),
    supabase
      .from("proof_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("appointments")
      .select("*, availability_slots(*), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, due_at, student_id, profiles(full_name)")
      .not("due_at", "is", null)
      .neq("status", "approved")
      .lte("due_at", addDays(now, 7).toISOString())
      .order("due_at", { ascending: true })
      .limit(10),
  ]);

  const today = ((todayRes.data ?? []) as ApptRow[]).sort(
    (a, b) =>
      new Date(a.availability_slots.starts_at).getTime() -
      new Date(b.availability_slots.starts_at).getTime()
  );
  const pendingProofs = proofsRes.count ?? 0;
  const studentCount = studentsRes.count ?? 0;
  const recent = (recentRes.data ?? []) as ApptRow[];
  const expiring = (expiringRes.data ?? []) as unknown as {
    id: string;
    title: string;
    due_at: string;
    student_id: string;
    profiles: { full_name: string | null } | null;
  }[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarCheck className="size-4" /> Sessions today
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{today.length}</CardContent>
        </Card>
        <Link href="/admin/proofs">
          <Card className={pendingProofs > 0 ? "border-primary" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileCheck className="size-4" /> Proofs waiting
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">
              {pendingProofs}
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/students">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="size-4" /> Students
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">
              {studentCount}
            </CardContent>
          </Card>
        </Link>
      </div>

      {expiring.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <CalendarClock className="size-4" /> Tasks expiring soon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiring.map((t) => {
              const overdue = new Date(t.due_at).getTime() < now.getTime();
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-muted-foreground">
                      {t.profiles?.full_name ?? "Student"} ·{" "}
                      <span className={overdue ? "font-semibold text-destructive" : ""}>
                        {overdue ? "Expired" : "Due"}{" "}
                        {format(new Date(t.due_at), "d MMM, h:mm a")}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/admin/students/${t.student_id}`} />}
                  >
                    Open
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {today.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled for today.
            </p>
          ) : (
            today.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">
                    {format(new Date(a.availability_slots.starts_at), "h:mm a")}{" "}
                    — {a.profiles?.full_name ?? "Student"}
                  </p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {a.mode}
                    {a.is_follow_up && " · follow-up"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/admin/appointments/${a.id}`} />}
                >
                  Open
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent bookings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            recent.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{a.profiles?.full_name ?? "Student"}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(
                      new Date(a.availability_slots.starts_at),
                      "EEE d MMM, h:mm a"
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/admin/appointments/${a.id}`} />}
                  >
                    Open
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
