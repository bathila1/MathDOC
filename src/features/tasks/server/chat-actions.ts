"use server";

import { getAuth } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { rateLimit } from "@/lib/server/ratelimit";
import { keyBelongsTo } from "@/lib/server/keys";
import { notify, notifyAdmins } from "@/features/notifications/server/notify";
import { taskMessageSchema } from "@/lib/shared/schemas";
import { z } from "zod";
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

  const rl = await rateLimit("chat", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = taskMessageSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { task_id, body, image_key } = parsed.data;

  // The key comes back through the client, so prove it is one we presigned for
  // THIS user — otherwise they could attach (and later download) another
  // user's file by submitting its key.
  if (image_key && !keyBelongsTo(image_key, auth.user.id)) {
    return fail("That image couldn't be attached. Please upload it again.");
  }

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

  // Ping the other side. (Task owner + title come from the service-role client.)
  const notifyClient = createSupabaseAdmin();
  const { data: t } = await notifyClient
    .from("tasks")
    .select("student_id, title")
    .eq("id", task_id)
    .maybeSingle();
  if (t) {
    if (role === "student") {
      await notifyAdmins({
        type: "message",
        title: "New message",
        body: `${auth.profile.full_name ?? "A student"}${t.title ? ` · “${t.title}”` : ""}`,
        link: `/admin/students/${t.student_id}`,
      });
    } else {
      await notify({
        userId: t.student_id,
        type: "message",
        title: "Sir replied",
        body: t.title ? `About “${t.title}”` : null,
        link: "/student",
      });
    }
  }

  return ok(data as TaskMessage);
}

/** Admin marks a task's student messages as seen (clears its unread dot). */
export async function markTaskChatSeen(
  taskId: string
): Promise<ActionResult<undefined>> {
  const auth = await getAuth();
  if (!auth || auth.profile.role !== "admin") return fail("Not allowed.");

  // Validate before it reaches the query builder rather than relying on
  // Postgres to reject a malformed id.
  const id = z.string().uuid().safeParse(taskId);
  if (!id.success) return fail("Unknown task.");

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("task_messages")
    .update({ seen_by_admin: true })
    .eq("task_id", id.data)
    .eq("sender_role", "student")
    .eq("seen_by_admin", false);
  if (error) {
    console.error("markTaskChatSeen failed:", error.message);
    return fail("Couldn't update.");
  }
  return ok(undefined);
}
