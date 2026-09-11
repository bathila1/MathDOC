import Link from "next/link";
import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import {
  Pagination,
  PAGE_SIZE,
  pageFrom,
  rangeFor,
} from "@/components/site/Pagination";
import {
  activityStatus,
  ACTIVITY_META,
  type ActivityStatus,
} from "@/lib/shared/activity";
import type { Profile } from "@/lib/shared/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { formatSchool as format } from "@/lib/shared/time";
import { Flag } from "lucide-react";

export const metadata = { title: "Activity" };

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const page = pageFrom((await searchParams).page);
  const [from, to] = rangeFor(page);

  const supabase = await createSupabaseServer();
  const { data, count } = await supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("role", "student")
    .order("last_login_at", { ascending: false, nullsFirst: false })
    .range(from, to);
  const students = (data ?? []) as Profile[];
  const ids = students.map((s) => s.id);

  const thirtyDaysAgo = new Date().getTime() - 30 * 86_400_000;

  const [taskRes, loginRes] = await Promise.all([
    ids.length
      ? supabase
          .from("tasks")
          .select("student_id, status, student_flag")
          .in("student_id", ids)
      : Promise.resolve({
          data: [] as {
            student_id: string;
            status: string;
            student_flag: string | null;
          }[],
        }),
    ids.length
      ? supabase
          .from("login_activity")
          .select("student_id, created_at")
          .in("student_id", ids)
      : Promise.resolve({ data: [] as { student_id: string; created_at: string }[] }),
  ]);

  const approved = new Map<string, number>();
  const total = new Map<string, number>();
  const flagged = new Map<string, number>();
  for (const t of (taskRes.data ?? []) as {
    student_id: string;
    status: string;
    student_flag: string | null;
  }[]) {
    total.set(t.student_id, (total.get(t.student_id) ?? 0) + 1);
    if (t.status === "approved") {
      approved.set(t.student_id, (approved.get(t.student_id) ?? 0) + 1);
    }
    if (t.student_flag) {
      flagged.set(t.student_id, (flagged.get(t.student_id) ?? 0) + 1);
    }
  }

  const loginsAll = new Map<string, number>();
  const logins30d = new Map<string, number>();
  for (const l of (loginRes.data ?? []) as {
    student_id: string;
    created_at: string;
  }[]) {
    loginsAll.set(l.student_id, (loginsAll.get(l.student_id) ?? 0) + 1);
    if (new Date(l.created_at).getTime() >= thirtyDaysAgo) {
      logins30d.set(l.student_id, (logins30d.get(l.student_id) ?? 0) + 1);
    }
  }

  // Status per student + a breakdown for the summary tiles.
  const statusOf = new Map<string, ActivityStatus>();
  const summary: Record<ActivityStatus, number> = {
    active: 0,
    partial: 0,
    inactive: 0,
  };
  for (const s of students) {
    const st = activityStatus(
      s.last_login_at,
      approved.get(s.id) ?? 0,
      total.get(s.id) ?? 0
    );
    statusOf.set(s.id, st);
    summary[st] += 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-muted-foreground">
          How engaged each student is, from their logins and task progress.
        </p>
      </div>

      {students.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No students yet.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["active", "partial", "inactive"] as ActivityStatus[]).map((st) => (
              <Card key={st}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-2xl font-bold">{summary[st]}</p>
                    <p className="text-xs text-muted-foreground">
                      {ACTIVITY_META[st].label}
                    </p>
                  </div>
                  <Badge variant={ACTIVITY_META[st].variant}>
                    {ACTIVITY_META[st].label}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Logins (30d / all)</TableHead>
                  <TableHead>Tasks done</TableHead>
                  <TableHead>Needs help</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const done = approved.get(s.id) ?? 0;
                  const all = total.get(s.id) ?? 0;
                  const meta = ACTIVITY_META[statusOf.get(s.id) ?? "inactive"];
                  const flags = flagged.get(s.id) ?? 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.full_name ?? (
                          <span className="text-muted-foreground">Not registered</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.last_login_at ? (
                          <span title={format(new Date(s.last_login_at), "d MMM yyyy, h:mm a")}>
                            {formatDistanceToNow(new Date(s.last_login_at), {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          "Never"
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {logins30d.get(s.id) ?? 0} / {loginsAll.get(s.id) ?? 0}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {all > 0 ? `${done}/${all}` : "—"}
                      </TableCell>
                      <TableCell>
                        {flags > 0 ? (
                          <Badge className="border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-950/40">
                            <Flag className="size-3" /> {flags}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={`/admin/students/${s.id}`} />}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={page}
            total={count ?? students.length}
            basePath="/admin/activity"
            size={PAGE_SIZE}
          />
        </>
      )}
    </div>
  );
}
