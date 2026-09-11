import { withAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import {
  AdminCalendar,
  type AdminSlot,
} from "@/features/booking/client/calendar/AdminCalendar";
import { subDays } from "date-fns";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const supabase = await createSupabaseServer();
  // withAdmin runs the guard and these queries together instead of one after
  // the other — see lib/server/auth.ts. Everything below is RLS-scoped.
  const { data } = await withAdmin(() =>
    supabase
      .from("availability_slots")
      .select("*, appointments(id, status, profiles(full_name))")
      .gt("starts_at", subDays(new Date(), 7).toISOString())
      .order("starts_at", { ascending: true })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">My availability</h1>
        <p className="text-muted-foreground">
          Click any empty space on the calendar to add a free time — students
          book from these.
        </p>
      </div>
      <AdminCalendar slots={(data ?? []) as AdminSlot[]} />
    </div>
  );
}
