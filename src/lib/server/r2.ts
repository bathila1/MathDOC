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

function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
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
