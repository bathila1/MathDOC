import Link from "next/link";
import { withAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { countPendingProofs } from "@/features/tasks/server/proofs";
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
import { addDays } from "date-fns";
import { formatSchool as format, schoolDayRange } from "@/lib/shared/time";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  FileCheck,
  Flag,
  MessageCircle,
  UserPlus,
  Users,
} from "lucide-react";

export const metadata = { title: "Dashboard" };

type ApptRow = Appointment & {
  availability_slots: AvailabilitySlot;
  profiles: Pick<Profile, "full_name">;
};

export default async function AdminDashboard() {
  const supabase = await createSupabaseServer();
  const now = new Date();
  // Sri Lankan midnight-to-midnight. date-fns startOfDay/endOfDay would use
  // the SERVER's day — a UTC one on Vercel, running 05:30 to 05:29 Colombo —
  // which dropped early-morning sessions out of "today" entirely.
  const todayRange = schoolDayRange(now);

  const [
    todayRes,
    pendingProofs,
    studentsRes,
    recentRes,
    expiringRes,
    registrationsRes,
    flaggedRes,
    messagesRes,
  // withAdmin runs the guard and these queries together instead of one after
  // the other — see lib/server/auth.ts. Everything below is RLS-scoped.
  ] = await withAdmin(() =>
    Promise.all([
    supabase
      .from("appointments")
      .select("*, availability_slots!inner(*), profiles(full_name)")
      .in("status", ["confirmed", "pending_payment"])
      .gte("availability_slots.starts_at", todayRange.start)
      .lte("availability_slots.starts_at", todayRange.end),
    // Shared with the sidebar badge via React cache — see countPendingProofs.
    countPendingProofs(),
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
    // Students who finished registering in the last week.
    supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("role", "student")
      .eq("profile_completed", true)
      .gte("created_at", addDays(now, -7).toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
    // Tasks a student has flagged for help and that aren't done yet.
    supabase
      .from("tasks")
      .select("id, title, student_flag, student_id, profiles(full_name)")
      .not("student_flag", "is", null)
      .neq("status", "approved")
      .limit(10),
    // Unseen student chat messages (grouped per task below).
    supabase
      .from("task_messages")
      .select("task_id, created_at, tasks(title, student_id, profiles(full_name))")
      .eq("sender_role", "student")
      .eq("seen_by_admin", false)
      .order("created_at", { ascending: false })
      .limit(20),
    ])
  );

  const today = ((todayRes.data ?? []) as ApptRow[]).sort(
    (a, b) =>
      new Date(a.availability_slots.starts_at).getTime() -
      new Date(b.availability_slots.starts_at).getTime()
  );
  const studentCount = studentsRes.count ?? 0;
  const recent = (recentRes.data ?? []) as ApptRow[];
  const expiring = (expiringRes.data ?? []) as unknown as {
    id: string;
    title: string;
    due_at: string;
    student_id: string;
    profiles: { full_name: string | null } | null;
  }[];
  const registrations = (registrationsRes.data ?? []) as {
    id: string;
    full_name: string | null;
    created_at: string;
  }[];
  const flagged = (flaggedRes.data ?? []) as unknown as {
    id: string;
    title: string;
    student_flag: "hard" | "cant_do";
    student_id: string;
    profiles: { full_name: string | null } | null;
  }[];
  const flagLabel: Record<string, string> = {
    hard: "finds this hard",
    cant_do: "can't do this",
  };

  // Unseen messages, one entry per task (newest first).
  const unseenMsgRows = (messagesRes.data ?? []) as unknown as {
    task_id: string;
    created_at: string;
    tasks: {
      title: string;
      student_id: string;
      profiles: { full_name: string | null } | null;
    } | null;
  }[];
  const messagesByTask = new Map<
    string,
    { taskTitle: string; studentId: string; studentName: string | null; at: string }
  >();
  for (const m of unseenMsgRows) {
    if (m.tasks && !messagesByTask.has(m.task_id)) {
      messagesByTask.set(m.task_id, {
        taskTitle: m.tasks.title,
        studentId: m.tasks.student_id,
        studentName: m.tasks.profiles?.full_name ?? null,
        at: m.created_at,
      });
    }
  }
  const messages = Array.from(messagesByTask.values()).slice(0, 6);

  const hasAlerts =
    pendingProofs > 0 ||
    flagged.length > 0 ||
    registrations.length > 0 ||
    messages.length > 0;

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

      {hasAlerts && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-primary" /> Needs your attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {messages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Messages
                </p>
                {messages.map((m) => (
                  <Link
                    key={`${m.studentId}-${m.taskTitle}`}
                    href={`/admin/students/${m.studentId}`}
                    className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm transition-colors hover:bg-muted/70"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MessageCircle className="size-4" />
                    </span>
                    <span className="flex-1">
                      <strong>{m.studentName ?? "A student"}</strong> messaged you —{" "}
                      <span className="text-muted-foreground">“{m.taskTitle}”</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.at), "d MMM")}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {pendingProofs > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Proofs
                </p>
                <Link
                  href="/admin/proofs"
                  className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm transition-colors hover:bg-muted/70"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileCheck className="size-4" />
                  </span>
                  <span className="flex-1">
                    <strong>{pendingProofs}</strong> proof
                    {pendingProofs > 1 ? "s" : ""} waiting for your review
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </div>
            )}

            {flagged.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Needs help
                </p>
                {flagged.map((f) => (
                  <Link
                    key={f.id}
                    href={`/admin/students/${f.student_id}`}
                    className="flex items-center gap-3 rounded-xl bg-amber-500/10 p-3 text-sm transition-colors hover:bg-amber-500/20"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      <Flag className="size-4" />
                    </span>
                    <span className="flex-1">
                      <strong>{f.profiles?.full_name ?? "A student"}</strong>{" "}
                      {flagLabel[f.student_flag]} —{" "}
                      <span className="text-muted-foreground">“{f.title}”</span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}

            {registrations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  New students
                </p>
                {registrations.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/students/${r.id}`}
                    className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm transition-colors hover:bg-muted/70"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserPlus className="size-4" />
                    </span>
                    <span className="flex-1">
                      <strong>{r.full_name ?? "New student"}</strong> just registered
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "d MMM")}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <Link
              href="/admin/activity"
              className="block pt-1 text-center text-sm font-medium text-primary hover:underline"
            >
              View all activity →
            </Link>
          </CardContent>
        </Card>
      )}

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
