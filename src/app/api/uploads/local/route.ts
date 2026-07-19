import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/server/supabase";
import { r2Configured } from "@/lib/server/r2";
import { MAX_UPLOAD_BYTES } from "@/lib/shared/constants";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * DEV-ONLY upload target used when Cloudflare R2 is not configured.
 * Stores files under public/uploads/ so they are served statically.
 */
export async function PUT(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || r2Configured()) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const key = request.nextUrl.searchParams.get("key") ?? "";
  // Keys are purpose/userId/random-name — refuse anything path-like.
  if (!/^[a-z_]+\/[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(key) || key.includes("..")) {
    return NextResponse.json({ error: "Bad key." }, { status: 400 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large." }, { status: 413 });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);

  return NextResponse.json({ ok: true });
}
