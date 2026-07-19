"use client";

import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/shared/constants";

export interface UploadedFile {
  key: string;
  name: string;
}

/**
 * Upload a file: ask the server for a presigned URL (R2) or a local dev
 * endpoint, then PUT the bytes directly. Returns the stored object key.
 */
export async function uploadFile(
  file: File,
  purpose: "task_attachment" | "proof"
): Promise<UploadedFile> {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    throw new Error("Only PDF, JPG, PNG or WebP files are allowed.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("The file is too large — maximum size is 10 MB.");
  }

  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_name: file.name,
      content_type: file.type,
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
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("The upload failed. Please check your connection and try again.");
  }

  return { key: presign.key, name: file.name };
}
