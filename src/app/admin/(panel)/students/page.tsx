import Link from "next/link";
import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import {
  Pagination,
  PAGE_SIZE,
  pageFrom,
  rangeFor,
} from "@/components/site/Pagination";
import { SearchBox } from "@/components/site/SearchBox";
import { FilterSelect } from "@/components/site/FilterSelect";
import { ViewToggle } from "@/components/site/ViewToggle";
import { STUDENT_CATEGORIES } from "@/lib/shared/constants";
import type { Profile } from "@/lib/shared/types";
import { formatPhone } from "@/lib/shared/phone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Phone, User } from "lucide-react";

export const metadata = { title: "Students" };

const categoryOptions = [
  ...STUDENT_CATEGORIES.map((c) => ({ value: c, label: c })),
  { value: "unset", label: "Not set" },
];
const validCat = new Set(categoryOptions.map((o) => o.value));

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    category?: string;
    q?: string;
    view?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const cat = sp.category && validCat.has(sp.category) ? sp.category : "all";
  const q = (sp.q ?? "").replace(/[%,()]/g, " ").trim();
  // Students default to the list view; cards is the opt-in.
  const view = sp.view === "cards" ? "cards" : "list";
  const page = pageFrom(sp.page);
  const [from, to] = rangeFor(page);

  const supabase = await createSupabaseServer();
  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (cat === "unset") query = query.is("category", null);
  else if (cat !== "all") query = query.eq("category", cat);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data, count } = await query;

  const students = (data ?? []) as Profile[];

  const carry = new URLSearchParams();
  if (cat !== "all") carry.set("category", cat);
  if (q) carry.set("q", q);
  if (view === "cards") carry.set("view", view);
  const listBase = carry.toString()
    ? `/admin/students?${carry.toString()}`
    : "/admin/students";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Students</h1>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox paramName="q" placeholder="Search by name or phone…" />
        <FilterSelect
          paramName="category"
          allLabel="All levels"
          options={categoryOptions}
        />
        <div className="ml-auto">
          <ViewToggle defaultView="list" />
        </div>
      </div>

      {students.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {q ? `No student matches “${q}”.` : "No students match these filters."}
        </p>
      ) : view === "list" ? (
        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/admin/students/${s.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
            >
              <span className="min-w-40 font-medium">
                {s.full_name ?? (
                  <span className="text-muted-foreground">Not registered</span>
                )}
              </span>
              <span className="text-muted-foreground">
                {s.phone ? formatPhone(s.phone) : "—"}
              </span>
              <span className="text-muted-foreground">Grade {s.grade ?? "—"}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.mcq_score != null ? `${s.mcq_score}/${s.mcq_total}` : "—"}
              </span>
              {s.category ? (
                <Badge variant="secondary" className="ml-auto">
                  {s.category}
                </Badge>
              ) : (
                <Badge variant="outline" className="ml-auto">
                  Not set
                </Badge>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg font-semibold">
                      {s.full_name ?? (
                        <span className="text-muted-foreground">
                          Not registered
                        </span>
                      )}
                    </p>
                    {s.phone && (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="size-3" />
                        {formatPhone(s.phone)}
                      </p>
                    )}
                  </div>
                </div>
                {s.category ? (
                  <Badge variant="secondary">{s.category}</Badge>
                ) : (
                  <Badge variant="outline">Not set</Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-3.5" />
                  Grade {s.grade ?? "—"}
                </span>
                <span>
                  Quiz:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {s.mcq_score != null ? `${s.mcq_score}/${s.mcq_total}` : "—"}
                  </span>
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-auto self-start"
                render={<Link href={`/admin/students/${s.id}`} />}
              >
                View profile
              </Button>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        total={count ?? students.length}
        basePath={listBase}
        size={PAGE_SIZE}
      />
    </div>
  );
}
