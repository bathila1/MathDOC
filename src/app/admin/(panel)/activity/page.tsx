import Link from "next/link";
import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import {
  Pagination,
  PAGE_SIZE,
  pageFrom,
  rangeFor,
} from "@/components/site/Pagination";
import { activityStatus, ACTIVITY_META } from "@/lib/shared/activity";
import type { Profile } from "@/lib/shared/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

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

  const thirtyDaysAgo = new Date(
    new Date().getTime() - 30 * 86_400_000
  ).toISOString();

  const [taskRes, loginRes] = await Promise.all([
    ids.length
      ? supabase.from("tasks").select("student_id, status").in("student_id", ids)
      : Promise.resolve({ data: [] as { student_id: string; status: string }[] }),
    ids.length
      ? supabase
          .from("login_activity")
          .select("student_id")
          .in("student_id", ids)
          .gte("created_at", thirtyDaysAgo)
      : Promise.resolve({ data: [] as { student_id: string }[] }),
  ]);

  const approved = new Map<string, number>();
  const total = new Map<string, number>();
  for (const t of (taskRes.data ?? []) as { student_id: string; status: string }[]) {
    total.set(t.student_id, (total.get(t.student_id) ?? 0) + 1);
    if (t.status === "approved") {
      approved.set(t.student_id, (approved.get(t.student_id) ?? 0) + 1);
    }
  }
  const logins30d = new Map<string, number>();
  for (const l of (loginRes.data ?? []) as { student_id: string }[]) {
    logins30d.set(l.student_id, (logins30d.get(l.student_id) ?? 0) + 1);
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
        <p className="py-8 text-center text-muted-foreground">
          No students yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Logins (30d)</TableHead>
                  <TableHead>Tasks done</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const done = approved.get(s.id) ?? 0;
                  const all = total.get(s.id) ?? 0;
                  const status = activityStatus(s.last_login_at, done, all);
                  const meta = ACTIVITY_META[status];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.full_name ?? (
                          <span className="text-muted-foreground">
                            Not registered
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.last_login_at
                          ? format(new Date(s.last_login_at), "d MMM, h:mm a")
                          : "Never"}
                      </TableCell>
                      <TableCell>{logins30d.get(s.id) ?? 0}</TableCell>
                      <TableCell>
                        {all > 0 ? `${done}/${all}` : "—"}
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
