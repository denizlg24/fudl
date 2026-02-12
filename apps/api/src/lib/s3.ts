/**
 * AWS S3 client and helper functions for video storage
 *
 * Bucket key structure:
 *   orgs/{orgId}/videos/{videoId}/original.{ext}
 *   orgs/{orgId}/videos/{videoId}/thumbnail.jpg
 *   orgs/{orgId}/videos/{videoId}/clips/{clipId}.{ext}
 */

import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";

// ---------------------------------------------------------------------------
// S3 Client singleton
// ---------------------------------------------------------------------------

export const s3 = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

export const S3_BUCKET = config.s3.bucket;
export const S3_REGION = config.s3.region;

// ---------------------------------------------------------------------------
// MIME → file extension mapping
// ---------------------------------------------------------------------------

const MIME_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
};

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/** Build the S3 key for a video's original file. */
export function getVideoKey(
  orgId: string,
  videoId: string,
  mimeType: string,
): string {
  const ext = MIME_TO_EXT[mimeType] ?? "mp4";
  return `orgs/${orgId}/videos/${videoId}/original.${ext}`;
}

/** Build the S3 key for a video's thumbnail. */
export function getThumbnailKey(orgId: string, videoId: string): string {
  return `orgs/${orgId}/videos/${videoId}/thumbnail.jpg`;
}

/** Build the S3 key prefix for all objects belonging to a video. */
export function getVideoPrefix(orgId: string, videoId: string): string {
  return `orgs/${orgId}/videos/${videoId}/`;
}

/**
 * Build a public URL for an S3 object.
 * @deprecated The bucket is private — use `getSignedDownloadUrl()` instead.
 */
export function getPublicUrl(key: string): string {
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

// ---------------------------------------------------------------------------
// Multipart upload helpers
// ---------------------------------------------------------------------------

/** Initiate a new S3 multipart upload. */
export async function createMultipartUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new CreateMultipartUploadCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const response = await s3.send(command);
  if (!response.UploadId) {
    throw new Error("S3 CreateMultipartUpload did not return an UploadId");
  }
  return response.UploadId;
}

/** Generate a presigned URL for uploading a single part. */
export async function signUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: S3_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  // Presigned URL valid for 1 hour
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

/** Complete a multipart upload by submitting the part manifest. */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: S3_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag.startsWith('"') ? p.etag : `"${p.etag}"`,
        })),
    },
  });
  await s3.send(command);
}

/** Abort an in-progress multipart upload. */
export async function abortMultipartUpload(
  key: string,
  uploadId: string,
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: S3_BUCKET,
    Key: key,
    UploadId: uploadId,
  });
  await s3.send(command);
}

// ---------------------------------------------------------------------------
// Object operations
// ---------------------------------------------------------------------------

/** Delete a single S3 object. */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  await s3.send(command);
}

/** Delete all objects under a prefix (e.g., all files for a video). */
export async function deletePrefix(prefix: string): Promise<void> {
  // List all objects under prefix
  const listCommand = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  });
  const listResponse = await s3.send(listCommand);

  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    return;
  }

  // Delete in batches of 1000 (S3 limit)
  const objects = listResponse.Contents.map((obj) => ({ Key: obj.Key! }));
  const deleteCommand = new DeleteObjectsCommand({
    Bucket: S3_BUCKET,
    Delete: { Objects: objects },
  });
  await s3.send(deleteCommand);
}

/** Check if an object exists and get its metadata. */
export async function headObject(
  key: string,
): Promise<{ contentLength: number; contentType: string } | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    const response = await s3.send(command);
    return {
      contentLength: response.ContentLength ?? 0,
      contentType: response.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

/** Generate a presigned GET URL for downloading/streaming an object. */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/** Upload a thumbnail buffer to S3. Returns only the S3 key — use presigned URLs for access. */
export async function uploadThumbnail(
  orgId: string,
  videoId: string,
  data: Uint8Array,
  contentType = "image/jpeg",
): Promise<{ key: string }> {
  const key = getThumbnailKey(orgId, videoId);
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: data,
    ContentType: contentType,
  });
  await s3.send(command);
  return { key };
}
