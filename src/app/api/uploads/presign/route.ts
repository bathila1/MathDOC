import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/server/supabase";
import { rateLimit } from "@/lib/server/ratelimit";
import { presignSchema } from "@/lib/shared/schemas";
import { buildObjectKey, presignUpload, r2Configured } from "@/lib/server/r2";

/**
 * Returns a presigned PUT URL (Cloudflare R2) for an authenticated user's
 * upload. In dev without R2 keys it falls back to a local upload endpoint.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please log in to upload files." },
      { status: 401 }
    );
  }

  const rl = await rateLimit("upload", `user:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "That file can't be uploaded.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { file_name, content_type, size, purpose } = parsed.data;
  const key = buildObjectKey(purpose, user.id, file_name);

  if (r2Configured()) {
    const upload_url = await presignUpload(key, content_type, size);
    return NextResponse.json({ upload_url, key });
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "File storage is not configured yet. Please try again later." },
      { status: 503 }
    );
  }

  // Local dev fallback — files land in public/uploads/
  return NextResponse.json({
    upload_url: `/api/uploads/local?key=${encodeURIComponent(key)}`,
    key,
  });
}
