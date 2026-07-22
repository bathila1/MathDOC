import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import {
  Pagination,
  PAGE_SIZE,
  pageFrom,
  rangeFor,
} from "@/components/site/Pagination";
import type {
  Appointment,
  AvailabilitySlot,
  Profile,
} from "@/lib/shared/types";
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

export const metadata = { title: "Appointments" };

type Row = Appointment & {
  availability_slots: AvailabilitySlot;
  profiles: Pick<Profile, "id" | "full_name" | "phone">;
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_payment: "outline",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const page = pageFrom((await searchParams).page);
  const [from, to] = rangeFor(page);

  const supabase = await createSupabaseServer();
  const { data, count } = await supabase
    .from("appointments")
    .select("*, availability_slots(*), profiles(id, full_name, phone)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Appointments</h1>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No appointments yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {format(
                        new Date(a.availability_slots.starts_at),
                        "EEE d MMM, h:mm a"
                      )}
                      {a.is_follow_up && (
                        <Badge variant="outline" className="ml-2">
                          Follow-up
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {a.profiles?.id ? (
                        <Link
                          href={`/admin/students/${a.profiles.id}`}
                          className="text-primary underline underline-offset-2"
                        >
                          {a.profiles.full_name ?? "Student"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{a.mode}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[a.status] ?? "outline"}>
                        {a.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={`/admin/appointments/${a.id}`} />}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={page}
            total={count ?? rows.length}
            basePath="/admin/appointments"
            size={PAGE_SIZE}
          />
        </>
      )}
    </div>
  );
}
