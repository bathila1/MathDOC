import Link from "next/link";
import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import {
  Pagination,
  PAGE_SIZE,
  pageFrom,
  rangeFor,
} from "@/components/site/Pagination";
import type { Profile } from "@/lib/shared/types";
import { formatPhone } from "@/lib/shared/phone";
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

export const metadata = { title: "Students" };

export default async function AdminStudentsPage({
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
    .order("created_at", { ascending: false })
    .range(from, to);

  const students = (data ?? []) as Profile[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Students</h1>
      {students.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No students have registered yet.
        </p>
      ) : (
        <>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Quiz score</TableHead>
                <TableHead>Category</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.full_name ?? <span className="text-muted-foreground">Not registered</span>}
                  </TableCell>
                  <TableCell>{s.phone ? formatPhone(s.phone) : "—"}</TableCell>
                  <TableCell>{s.grade ?? "—"}</TableCell>
                  <TableCell>
                    {s.mcq_score != null ? `${s.mcq_score}/${s.mcq_total}` : "—"}
                  </TableCell>
                  <TableCell>
                    {s.category ? (
                      <Badge variant="secondary">{s.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
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
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination
          page={page}
          total={count ?? students.length}
          basePath="/admin/students"
          size={PAGE_SIZE}
        />
        </>
      )}
    </div>
  );
}
