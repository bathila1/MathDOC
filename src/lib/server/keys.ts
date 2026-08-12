import "server-only";

/**
 * Ownership checks for R2 object keys.
 *
 * Uploads are presigned server-side into `purpose/userId/random-name`
 * (see buildObjectKey in r2.ts), but the resulting key travels back through
 * the CLIENT and is then submitted as plain text on a form (chat image, proof
 * files, task media). Nothing about that round-trip stops a caller from
 * submitting somebody else's key and having the server presign a download of
 * it later — files.ts even warns that callers must verify ownership first.
 *
 * These helpers are that verification. Reject at the point the key is STORED,
 * so a foreign key never becomes a row we would later happily sign.
 */

/** A key this user could legitimately have been given: purpose/<their id>/name */
export function keyBelongsTo(key: string, userId: string): boolean {
  if (!key) return false;
  // No traversal, no absolute paths, no scheme tricks.
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    return false;
  }
  const parts = key.split("/");
  if (parts.length !== 3) return false;
  const [purpose, owner, name] = parts;
  if (!/^[a-z_]+$/.test(purpose)) return false;
  if (owner !== userId) return false;
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

/** Every key must belong to the user; empty list passes. */
export function allKeysBelongTo(keys: string[], userId: string): boolean {
  return keys.every((k) => keyBelongsTo(k, userId));
}
