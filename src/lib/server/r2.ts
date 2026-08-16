import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

/**
 * Cloudflare R2 storage (S3-compatible). The bucket is PRIVATE — every
 * read/write goes through short-lived presigned URLs generated here.
 * In dev without R2 env vars, the local fallback in /api/uploads handles files.
 */

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

// Reused across calls. The student dashboard presigns up to 5 URLs per task,
// so building a fresh client (credential providers, HTTP handler, …) each time
// added real per-request overhead on media-heavy pages.
let _client: S3Client | null = null;
function r2Client() {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      // MUST stay WHEN_REQUIRED for presigned uploads.
      //
      // The SDK default is WHEN_SUPPORTED, which makes it compute a CRC32 of
      // the request body and bake it into the signed URL as
      // `x-amz-checksum-crc32`. At presign time there IS no body, so it signs
      // the checksum of zero bytes (AAAAAA== — CRC32 of empty). The browser
      // then PUTs the real file, R2 recomputes the checksum, they disagree, and
      // the upload is rejected. It also adds `x-amz-sdk-checksum-algorithm`,
      // which R2 does not accept on presigned PUTs.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return _client;
}

/** Build a namespaced object key: purpose/userId/random-filename */
export function buildObjectKey(
  purpose: string,
  userId: string,
  fileName: string
): string {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(-100);
  const rand = randomBytes(8).toString("hex");
  return `${purpose}/${userId}/${rand}-${safeName}`;
}

const UPLOAD_URL_TTL_SECONDS = 60 * 5;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 15;

export async function presignUpload(
  key: string,
  contentType: string,
  contentLength: number
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(r2Client(), cmd, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

export async function presignDownload(key: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
  });
  return getSignedUrl(r2Client(), cmd, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

export async function deleteObject(key: string): Promise<void> {
  const cmd = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
  });
  await r2Client().send(cmd);
}
