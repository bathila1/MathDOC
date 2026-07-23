"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { defaultTaskSchema } from "@/lib/shared/schemas";
import { z } from "zod";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { revalidatePath } from "next/cache";

// Admin CRUD for reusable default-task templates. Runs through RLS
// ("default_tasks: admin all"). Edited under the Placement exam tab.

async function guard(): Promise<string | null> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  return rl.allowed ? null : rl.message!;
}

function toColumns(d: z.infer<typeof defaultTaskSchema>) {
  return {
    title: d.title,
    description: d.description,
    type: d.type,
    is_priority: Boolean(d.is_priority),
    timer_seconds: d.timer_minutes ? d.timer_minutes * 60 : null,
  };
}

export async function createDefaultTask(
  input: unknown
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const parsed = defaultTaskSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  const { data: last } = await supabase
    .from("default_tasks")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("default_tasks").insert({
    ...toColumns(parsed.data),
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return fail("Couldn't add the template. Please try again.");

  revalidatePath("/admin/exam");
  return ok(undefined);
}

export async function updateDefaultTask(
  templateId: string,
  input: unknown
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const id = z.string().uuid().safeParse(templateId);
  if (!id.success) return fail("Unknown template.");
  const parsed = defaultTaskSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("default_tasks")
    .update(toColumns(parsed.data))
    .eq("id", id.data);
  if (error) return fail("Couldn't update the template. Please try again.");

  revalidatePath("/admin/exam");
  return ok(undefined);
}

export async function deleteDefaultTask(
  templateId: string
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const id = z.string().uuid().safeParse(templateId);
  if (!id.success) return fail("Unknown template.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("default_tasks")
    .delete()
    .eq("id", id.data);
  if (error) return fail("Couldn't delete the template.");

  revalidatePath("/admin/exam");
  return ok(undefined);
}

/** Swap sort_order with the neighbour above/below. */
export async function moveDefaultTask(
  templateId: string,
  direction: "up" | "down"
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const id = z.string().uuid().safeParse(templateId);
  if (!id.success) return fail("Unknown template.");

  const supabase = await createSupabaseServer();
  const { data: current } = await supabase
    .from("default_tasks")
    .select("id, sort_order")
    .eq("id", id.data)
    .single();
  if (!current) return fail("Unknown template.");

  const { data: neighbour } = await supabase
    .from("default_tasks")
    .select("id, sort_order")
    .order("sort_order", { ascending: direction === "down" })
    [direction === "down" ? "gt" : "lt"]("sort_order", current.sort_order)
    .limit(1)
    .maybeSingle();
  if (!neighbour) return ok(undefined);

  await supabase
    .from("default_tasks")
    .update({ sort_order: neighbour.sort_order })
    .eq("id", current.id);
  await supabase
    .from("default_tasks")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbour.id);

  revalidatePath("/admin/exam");
  return ok(undefined);
}
