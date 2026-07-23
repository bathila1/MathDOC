"use client";

import { UPLOAD_RULES, type UploadPurpose } from "@/lib/shared/constants";

export interface UploadedFile {
  key: string;
  name: string;
}

/** Base MIME without codec params, e.g. "audio/webm;codecs=opus" -> "audio/webm". */
function baseMime(type: string): string {
  return type.split(";")[0].trim();
}

/**
 * Upload a file: ask the server for a presigned URL (R2) or a local dev
 * endpoint, then PUT the bytes directly. Returns the stored object key.
 * Allowed types and size are enforced per purpose (see UPLOAD_RULES) both here
 * and again at presign time on the server.
 */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose
): Promise<UploadedFile> {
  const rule = UPLOAD_RULES[purpose];
  const contentType = baseMime(file.type);
  const mb = Math.round(rule.maxBytes / (1024 * 1024));

  if (!(rule.types as readonly string[]).includes(contentType)) {
    throw new Error("That file type isn't allowed here.");
  }
  if (file.size > rule.maxBytes) {
    throw new Error(`That file is too large (max ${mb} MB).`);
  }

  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_name: file.name,
      content_type: contentType,
      size: file.size,
      purpose,
    }),
  });
  const presign = await presignRes.json();
  if (!presignRes.ok) {
    throw new Error(presign.error ?? "Could not start the upload. Please try again.");
  }

  const putRes = await fetch(presign.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("The upload failed. Please check your connection and try again.");
  }

  return { key: presign.key, name: file.name };
}
