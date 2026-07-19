import "server-only";
import { presignDownload, r2Configured } from "./r2";

/**
 * Resolve a stored object key to a viewable URL.
 * R2: short-lived presigned GET. Dev fallback: static /uploads path.
 * Callers MUST verify the requester owns the file before calling this.
 */
export async function getDownloadUrl(key: string): Promise<string> {
  if (r2Configured()) return presignDownload(key);
  return `/uploads/${key}`;
}
