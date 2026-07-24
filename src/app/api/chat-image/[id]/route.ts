import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getDownloadUrl } from "@/lib/server/files";
import { z } from "zod";

/**
 * Serves a chat image by MESSAGE id, redirecting to a short-lived presigned
 * URL — but only for the teacher or the student who owns that task's chat.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Bad id." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data: msg } = await admin
    .from("task_messages")
    .select("task_id, image_key")
    .eq("id", id)
    .maybeSingle();
  if (!msg?.image_key) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (auth.profile.role !== "admin") {
    const { data: task } = await admin
      .from("tasks")
      .select("student_id")
      .eq("id", msg.task_id)
      .maybeSingle();
    if (!task || task.student_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  const url = await getDownloadUrl(msg.image_key);
  const absolute = url.startsWith("http")
    ? url
    : new URL(url, request.nextUrl.origin).toString();
  return NextResponse.redirect(absolute);
}
