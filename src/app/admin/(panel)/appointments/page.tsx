import Link from "next/link";
import { withAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import {
  Pagination,
  PAGE_SIZE,
  pageFrom,
  rangeFor,
} from "@/components/site/Pagination";
import { SearchBox } from "@/components/site/SearchBox";
import { FilterSelect } from "@/components/site/FilterSelect";
import { ViewToggle } from "@/components/site/ViewToggle";
import { appointmentCode } from "@/lib/shared/appointments";
import type {
  Appointment,
  AvailabilitySlot,
  Profile,
} from "@/lib/shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/shared/phone";
import { formatSchool as format } from "@/lib/shared/time";
import { CalendarCheck, Laptop, Users } from "lucide-react";

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

const statusOptions = [
  { value: "pending_payment", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const modeOptions = [
  { value: "physical", label: "In person" },
  { value: "online", label: "Online" },
];
const validStatus = new Set(statusOptions.map((o) => o.value));
const validMode = new Set(modeOptions.map((o) => o.value));

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    mode?: string;
    q?: string;
    view?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = sp.status && validStatus.has(sp.status) ? sp.status : "all";
  const mode = sp.mode && validMode.has(sp.mode) ? sp.mode : "all";
  const q = (sp.q ?? "").replace(/[%,()]/g, " ").trim();
  const view = sp.view === "list" ? "list" : "cards";
  const page = pageFrom(sp.page);
  const [from, to] = rangeFor(page);

  const supabase = await createSupabaseServer();
  let query = supabase
    .from("appointments")
    .select("*, availability_slots(*), profiles(id, full_name, phone)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status !== "all") query = query.eq("status", status);
  if (mode !== "all") query = query.eq("mode", mode);
  // `code` comes from migration 011 (a generated column). Searching before that
  // migration is applied simply returns nothing rather than breaking the page.
  if (q) query = query.ilike("code", `%${q}%`);
  // withAdmin runs the guard and this query together instead of one after
  // the other — see lib/server/auth.ts. The query is RLS-scoped.
  const { data, count } = await withAdmin(() => query);

  const rows = (data ?? []) as Row[];

  // Preserve active filters through pagination links.
  const carry = new URLSearchParams();
  if (status !== "all") carry.set("status", status);
  if (mode !== "all") carry.set("mode", mode);
  if (q) carry.set("q", q);
  if (view === "list") carry.set("view", view);
  const listBase = carry.toString()
    ? `/admin/appointments?${carry.toString()}`
    : "/admin/appointments";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Appointments</h1>

      {/* Filter bar: search + dropdowns + view switch */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox paramName="q" placeholder="Search by appointment code…" />
        <FilterSelect
          paramName="status"
          allLabel="All statuses"
          options={statusOptions}
        />
        <FilterSelect paramName="mode" allLabel="All types" options={modeOptions} />
        <div className="ml-auto">
          <ViewToggle />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {q
            ? `No appointment matches “${q}”.`
            : "No appointments match these filters."}
        </p>
      ) : view === "list" ? (
        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
          {rows.map((a) => {
            const slot = a.availability_slots;
            return (
              <Link
                key={a.id}
                href={`/admin/appointments/${a.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
              >
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  #{appointmentCode(a.id)}
                </span>
                <span className="min-w-40 font-medium">
                  {slot
                    ? format(new Date(slot.starts_at), "EEE d MMM, h:mm a")
                    : "—"}
                </span>
                <span className="min-w-32">
                  {a.profiles?.full_name ?? "Student"}
                </span>
                <span className="capitalize text-muted-foreground">
                  {a.mode}
                  {a.is_follow_up && " · follow-up"}
                </span>
                <Badge
                  variant={statusVariant[a.status] ?? "outline"}
                  className="ml-auto"
                >
                  {a.status.replace("_", " ")}
                </Badge>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => {
            const slot = a.availability_slots;
            return (
              <div
                key={a.id}
                className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-muted-foreground">
                      #{appointmentCode(a.id)}
                    </p>
                    <p className="font-heading text-lg font-semibold">
                      {slot ? format(new Date(slot.starts_at), "EEE d MMM") : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {slot ? format(new Date(slot.starts_at), "h:mm a") : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={statusVariant[a.status] ?? "outline"}>
                      {a.status.replace("_", " ")}
                    </Badge>
                    {a.is_follow_up && <Badge variant="outline">Follow-up</Badge>}
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <p className="font-medium">
                    {a.profiles?.id ? (
                      <Link
                        href={`/admin/students/${a.profiles.id}`}
                        className="text-primary underline underline-offset-2"
                      >
                        {a.profiles.full_name ?? "Student"}
                      </Link>
                    ) : (
                      (a.profiles?.full_name ?? "Student")
                    )}
                  </p>
                  {a.profiles?.phone && (
                    <p className="text-muted-foreground">
                      {formatPhone(a.profiles.phone)}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-muted-foreground capitalize">
                    {a.mode === "online" ? (
                      <Laptop className="size-3.5" />
                    ) : (
                      <Users className="size-3.5" />
                    )}
                    {a.mode}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto self-start"
                  render={<Link href={`/admin/appointments/${a.id}`} />}
                >
                  <CalendarCheck className="size-4" /> Open
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        total={count ?? rows.length}
        basePath={listBase}
        size={PAGE_SIZE}
      />
    </div>
  );
}
