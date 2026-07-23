"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getAuth, requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { recalcTaskStatuses } from "./logic";
import {
  taskSchema,
  taskEditSchema,
  proofSubmitSchema,
  proofReviewSchema,
} from "@/lib/shared/schemas";
import { z } from "zod";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { revalidatePath } from "next/cache";

function refresh(appointmentId: string) {
  revalidatePath(`/admin/appointments/${appointmentId}`);
  revalidatePath("/admin/proofs");
  revalidatePath("/student");
}

interface TaskFormFields {
  type: "task" | "meet_sir";
  title: string;
  description: string;
  attachment_key?: string | null;
  is_priority?: boolean;
  timer_minutes?: number | null;
  due_at?: string | null;
  youtube_url?: string | null;
  facebook_url?: string | null;
  video_key?: string | null;
  voice_key?: string | null;
  question_image_key?: string | null;
}

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

/** Map validated form fields to task table columns (minutes→seconds, date→ISO). */
function toTaskColumns(d: TaskFormFields) {
  const timer_seconds = d.timer_minutes ? d.timer_minutes * 60 : null;

  let due_at: string | null = null;
  if (d.due_at && d.due_at.trim()) {
    const parsed = new Date(d.due_at);
    if (!Number.isNaN(parsed.getTime())) due_at = parsed.toISOString();
  }

  return {
    type: d.type,
    title: d.title,
    description: d.description,
    attachment_key: clean(d.attachment_key),
    is_priority: Boolean(d.is_priority),
    timer_seconds,
    due_at,
    youtube_url: clean(d.youtube_url),
    facebook_url: clean(d.facebook_url),
    video_key: clean(d.video_key),
    voice_key: clean(d.voice_key),
    question_image_key: clean(d.question_image_key),
  };
}

// ---------------- Admin: task building ----------------

export async function addTask(input: unknown): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { appointment_id } = parsed.data;

  const supabase = await createSupabaseServer();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, student_id")
    .eq("id", appointment_id)
    .maybeSingle();
  if (!appt) return fail("We couldn't find that appointment.");

  // The journey is one global sequence per student — append to the end.
  const { data: last } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("student_id", appt.student_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("tasks").insert({
    ...toTaskColumns(parsed.data),
    appointment_id,
    student_id: appt.student_id,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) {
    console.error("addTask failed:", error.message);
    return fail(
      "Couldn't add the task. If this keeps happening, the latest database migration may not be applied yet."
    );
  }

  await recalcTaskStatuses(appointment_id);
  refresh(appointment_id);
  return ok(undefined);
}

export async function updateTask(input: unknown): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = taskEditSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { task_id } = parsed.data;

  const supabase = await createSupabaseServer();
  const { data: existing } = await supabase
    .from("tasks")
    .select("appointment_id")
    .eq("id", task_id)
    .maybeSingle();
  if (!existing) return fail("We couldn't find that task.");

  const { error } = await supabase
    .from("tasks")
    .update(toTaskColumns(parsed.data))
    .eq("id", task_id);
  if (error) {
    console.error("updateTask failed:", error.message);
    return fail("Couldn't save the task. Please try again.");
  }

  await recalcTaskStatuses(existing.appointment_id);
  refresh(existing.appointment_id);
  return ok(undefined);
}

export async function deleteTask(taskId: string): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(taskId);
  if (!id.success) return fail("Unknown task.");

  const supabase = await createSupabaseServer();
  const { data: existing } = await supabase
    .from("tasks")
    .select("appointment_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!existing) return fail("We couldn't find that task.");

  const { error } = await supabase.from("tasks").delete().eq("id", id.data);
  if (error) return fail("Couldn't delete the task.");

  await recalcTaskStatuses(existing.appointment_id);
  refresh(existing.appointment_id);
  return ok(undefined);
}

export async function moveTask(
  taskId: string,
  direction: "up" | "down"
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(taskId);
  if (!id.success) return fail("Unknown task.");

  const supabase = await createSupabaseServer();
  const { data: current } = await supabase
    .from("tasks")
    .select("id, appointment_id, student_id, sort_order")
    .eq("id", id.data)
    .maybeSingle();
  if (!current) return fail("Unknown task.");

  // Neighbour anywhere in the student's journey (sessions are just tags).
  const query = supabase
    .from("tasks")
    .select("id, sort_order")
    .eq("student_id", current.student_id)
    .order("sort_order", { ascending: direction === "down" })
    .limit(1);
  const { data: neighbour } = await (direction === "down"
    ? query.gt("sort_order", current.sort_order)
    : query.lt("sort_order", current.sort_order)
  ).maybeSingle();
  if (!neighbour) return ok(undefined);

  await supabase
    .from("tasks")
    .update({ sort_order: neighbour.sort_order })
    .eq("id", current.id);
  await supabase
    .from("tasks")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbour.id);

  await recalcTaskStatuses(current.appointment_id);
  refresh(current.appointment_id);
  return ok(undefined);
}

/**
 * Persist a drag-and-drop reorder: `taskIds` is the student's whole journey
 * in its new order. Rewrites sort_order 1..n, then recalculates unlocks.
 */
export async function reorderTasks(
  taskIds: string[]
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = z.array(z.string().uuid()).min(1).max(200).safeParse(taskIds);
  if (!parsed.success) return fail("Couldn't save the new order.");

  const admin = createSupabaseAdmin();
  const { data: existing } = await admin
    .from("tasks")
    .select("id, student_id, appointment_id")
    .in("id", parsed.data);

  // All tasks must exist and belong to a single student.
  if (!existing || existing.length !== parsed.data.length) {
    return fail("Couldn't save the new order — please refresh and try again.");
  }
  const studentIds = new Set(existing.map((t) => t.student_id));
  if (studentIds.size !== 1) return fail("Tasks must belong to one student.");

  for (const [index, taskId] of parsed.data.entries()) {
    await admin
      .from("tasks")
      .update({ sort_order: index + 1 })
      .eq("id", taskId);
  }

  await recalcTaskStatuses(existing[0].appointment_id);
  refresh(existing[0].appointment_id);
  revalidatePath(`/admin/students/${existing[0].student_id}`);
  return ok(undefined);
}

/** Approve the current task without a proof (used for Meet-with-Sir checkpoints). */
export async function approveTask(taskId: string): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(taskId);
  if (!id.success) return fail("Unknown task.");

  const supabase = await createSupabaseServer();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, appointment_id, status")
    .eq("id", id.data)
    .maybeSingle();
  if (!task) return fail("We couldn't find that task.");
  if (task.status === "locked") {
    return fail("Earlier tasks must be finished first.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "approved" })
    .eq("id", id.data);
  if (error) return fail("Couldn't approve the task.");

  await recalcTaskStatuses(task.appointment_id);
  refresh(task.appointment_id);
  return ok(undefined);
}

// ---------------- Student: proof submission ----------------

export async function submitProof(input: unknown): Promise<ActionResult<undefined>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");
  if (auth.profile.role !== "student") return fail("Only students submit proofs.");

  const rl = await rateLimit("form", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = proofSubmitSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { task_id, file_keys, student_note, time_spent_seconds } = parsed.data;

  // Don't accept work on a task that has already expired.
  const admin0 = createSupabaseAdmin();
  const { data: dueRow } = await admin0
    .from("tasks")
    .select("due_at")
    .eq("id", task_id)
    .maybeSingle();
  if (dueRow?.due_at && new Date(dueRow.due_at).getTime() < Date.now()) {
    return fail(
      "This task has expired, so you can't submit it anymore. Please talk to Sir."
    );
  }

  // Insert as the student — the RLS policy enforces "own ACTIVE task only".
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("proof_submissions").insert({
    task_id,
    student_id: auth.user.id,
    file_keys,
    student_note: student_note || null,
    time_spent_seconds: time_spent_seconds ?? null,
  });
  if (error) {
    return fail(
      "We couldn't submit this proof. Make sure this is your current task and try again."
    );
  }

  const admin = createSupabaseAdmin();
  const { data: task } = await admin
    .from("tasks")
    .select("appointment_id")
    .eq("id", task_id)
    .single();
  if (task) {
    await recalcTaskStatuses(task.appointment_id);
    refresh(task.appointment_id);
  }
  return ok(undefined);
}

// ---------------- Admin: proof review ----------------

export async function reviewProof(input: unknown): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = proofReviewSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { proof_id, decision, teacher_note } = parsed.data;

  const supabase = await createSupabaseServer();
  const { data: proof } = await supabase
    .from("proof_submissions")
    .select("id, task_id, status")
    .eq("id", proof_id)
    .maybeSingle();
  if (!proof) return fail("We couldn't find that submission.");
  if (proof.status !== "pending") return fail("This proof was already reviewed.");

  const { error } = await supabase
    .from("proof_submissions")
    .update({
      status: decision,
      teacher_note: teacher_note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", proof_id);
  if (error) return fail("Couldn't save the review.");

  const admin = createSupabaseAdmin();
  const { data: task } = await admin
    .from("tasks")
    .select("id, appointment_id")
    .eq("id", proof.task_id)
    .single();

  if (task) {
    if (decision === "accepted") {
      await admin.from("tasks").update({ status: "approved" }).eq("id", task.id);
    }
    await recalcTaskStatuses(task.appointment_id);
    refresh(task.appointment_id);
  }
  return ok(undefined);
}
