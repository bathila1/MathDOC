"use server";

import { getAuth } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { rateLimit } from "@/lib/server/ratelimit";
import { taskMessageSchema } from "@/lib/shared/schemas";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import type { TaskMessage } from "@/lib/shared/types";

/** Post a message on a task's chat. Delivery to the other side is via Realtime. */
export async function sendTaskMessage(
  input: unknown
): Promise<ActionResult<TaskMessage>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");

  const rl = await rateLimit("form", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = taskMessageSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { task_id, body, image_key } = parsed.data;

  const role = auth.profile.role; // 'student' | 'admin'

  // Students may only post on their own task; the teacher on any task.
  if (role === "student") {
    const admin = createSupabaseAdmin();
    const { data: task } = await admin
      .from("tasks")
      .select("id, student_id")
      .eq("id", task_id)
      .maybeSingle();
    if (!task || task.student_id !== auth.user.id) {
      return fail("We couldn't find that task.");
    }
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("task_messages")
    .insert({
      task_id,
      sender_id: auth.user.id,
      sender_role: role,
      body,
      image_key: image_key || null,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("sendTaskMessage failed:", error?.message);
    return fail("Couldn't send the message. Please try again.");
  }

  return ok(data as TaskMessage);
}
