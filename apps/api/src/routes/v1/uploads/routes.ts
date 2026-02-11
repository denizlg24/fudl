/**
 * Upload Routes - v1
 * Manages multipart upload lifecycle for video files via S3 presigned URLs.
 *
 * Flow:
 *   1. POST /init        — Create S3 multipart upload + UploadSession in DB
 *   2. POST /sign-part   — Get presigned URL for a single part
 *   3. POST /complete-part — Record a completed part (ETag + partNumber)
 *   4. POST /complete    — Finalize S3 multipart upload, queue processing job
 *   5. POST /abort       — Cancel upload, clean up S3 + DB
 *   6. GET  /status      — Check upload progress (for resumption)
 */

import { Elysia, t } from "elysia";
import { prisma } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";
import {
  getVideoKey,
  getPublicUrl,
  createMultipartUpload,
  signUploadPart,
  completeMultipartUpload as s3CompleteMultipart,
  abortMultipartUpload as s3AbortMultipart,
  uploadThumbnail,
  S3_BUCKET,
  S3_REGION,
} from "../../../lib/s3";
import { videoProcessingQueue } from "../../../lib/queues";

/** Default part size: 10 MB */
const DEFAULT_PART_SIZE = 10 * 1024 * 1024;
/** Minimum part size per S3 spec: 5 MB (except last part) */
const MIN_PART_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
] as const;

export const uploadRoutes = new Elysia({
  prefix: "/orgs/:organizationId/videos/:videoId/upload",
})
  .use(authPlugin)

  // -------------------------------------------------------------------------
  // POST /init — Initialize multipart upload
  // -------------------------------------------------------------------------
  .post(
    "/init",
    async ({ params, body, user }) => {
      const { organizationId, videoId } = params;

      // Validate video exists, belongs to org, and is in uploadable state
      const video = await prisma.video.findFirst({
        where: { id: videoId, organizationId },
        include: { uploadSession: true },
      });

      if (!video) {
        throw new ApiError(404, "Video not found");
      }

      if (video.status !== "PENDING" && video.status !== "FAILED") {
        throw new ApiError(
          400,
          `Video is in '${video.status}' state and cannot start a new upload`,
        );
      }

      // If there's an existing upload session, abort it first
      if (video.uploadSession) {
        try {
          await s3AbortMultipart(
            video.uploadSession.s3Key,
            video.uploadSession.s3UploadId,
          );
        } catch {
          // S3 abort may fail if upload already expired — that's fine
        }
        await prisma.uploadSession.delete({
          where: { id: video.uploadSession.id },
        });
      }

      // Validate mime type
      if (
        !ALLOWED_MIME_TYPES.includes(
          body.mimeType as (typeof ALLOWED_MIME_TYPES)[number],
        )
      ) {
        throw new ApiError(
          400,
          `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
        );
      }

      const fileSize = BigInt(body.fileSize);
      const partSize = Math.max(DEFAULT_PART_SIZE, MIN_PART_SIZE);
      const totalParts = Math.ceil(Number(fileSize) / partSize);

      // Build S3 key
      const s3Key = getVideoKey(organizationId, videoId, body.mimeType);

      // Create S3 multipart upload
      const s3UploadId = await createMultipartUpload(s3Key, body.mimeType);

      // S3 multipart uploads expire after 7 days
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create upload session in DB
      const uploadSession = await prisma.uploadSession.create({
        data: {
          videoId,
          s3UploadId,
          s3Key,
          totalParts,
          partSize,
          completedParts: [],
          totalBytes: fileSize,
          uploadedBytes: BigInt(0),
          expiresAt,
        },
      });

      // Update video status and metadata
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "UPLOADING",
          mimeType: body.mimeType,
          fileSize,
          storageKey: s3Key,
          errorMessage: null,
        },
      });

      return {
        uploadSessionId: uploadSession.id,
        s3UploadId,
        s3Key,
        partSize,
        totalParts,
        expiresAt: expiresAt.toISOString(),
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
      body: t.Object({
        fileSize: t.String({ description: "File size as string (BigInt)" }),
        mimeType: t.String(),
        fileName: t.String(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // POST /sign-part — Generate presigned URL for a part upload
  // -------------------------------------------------------------------------
  .post(
    "/sign-part",
    async ({ params, body }) => {
      const { videoId } = params;

      const session = await prisma.uploadSession.findUnique({
        where: { videoId },
      });

      if (!session) {
        throw new ApiError(404, "No active upload session for this video");
      }

      if (new Date() > session.expiresAt) {
        throw new ApiError(410, "Upload session has expired");
      }

      if (body.partNumber < 1 || body.partNumber > session.totalParts) {
        throw new ApiError(
          400,
          `Part number must be between 1 and ${session.totalParts}`,
        );
      }

      const presignedUrl = await signUploadPart(
        session.s3Key,
        session.s3UploadId,
        body.partNumber,
      );

      return { presignedUrl, partNumber: body.partNumber };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
      body: t.Object({
        partNumber: t.Integer({ minimum: 1 }),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // POST /complete-part — Record a completed part
  // -------------------------------------------------------------------------
  .post(
    "/complete-part",
    async ({ params, body }) => {
      const { videoId } = params;

      const session = await prisma.uploadSession.findUnique({
        where: { videoId },
      });

      if (!session) {
        throw new ApiError(404, "No active upload session for this video");
      }

      // Calculate bytes uploaded for this part using BigInt to avoid
      // precision loss for large files (Number can lose precision > 2^53).
      const isLastPart = body.partNumber === session.totalParts;
      const partBytes = isLastPart
        ? session.totalBytes -
          BigInt(session.totalParts - 1) * BigInt(session.partSize)
        : BigInt(session.partSize);

      // Use a serializable interactive transaction to atomically append
      // the completed part to the JSON array. Serializable isolation
      // ensures ACID properties — concurrent complete-part calls are
      // serialized at the database level, preventing lost updates.
      const MAX_RETRIES = 3;
      let attempt = 0;

      while (true) {
        try {
          const result = await prisma.$transaction(
            async (tx) => {
              const current = await tx.uploadSession.findUnique({
                where: { videoId },
                select: { completedParts: true, totalParts: true },
              });

              if (!current) {
                throw new ApiError(
                  404,
                  "No active upload session for this video",
                );
              }

              const parts = Array.isArray(current.completedParts)
                ? (current.completedParts as Array<{ partNumber: number }>)
                : [];

              // Idempotency: if this part was already recorded, skip the update
              const alreadyRecorded = parts.some(
                (p) => p.partNumber === body.partNumber,
              );

              if (alreadyRecorded) {
                return {
                  recorded: true,
                  completedCount: parts.length,
                  totalParts: current.totalParts,
                };
              }

              const updatedParts = [
                ...parts,
                { partNumber: body.partNumber, etag: body.etag },
              ];

              await tx.uploadSession.update({
                where: { videoId },
                data: {
                  completedParts: updatedParts,
                  uploadedBytes: { increment: partBytes },
                },
              });

              return {
                recorded: true,
                completedCount: updatedParts.length,
                totalParts: current.totalParts,
              };
            },
            {
              isolationLevel: "Serializable",
              maxWait: 5000,
              timeout: 10000,
            },
          );

          return result;
        } catch (error) {
          attempt++;
          // P2034 = transaction conflict / serialization failure — safe to retry
          if (
            error instanceof Error &&
            "code" in error &&
            (error as { code: string }).code === "P2034" &&
            attempt < MAX_RETRIES
          ) {
            // Brief random backoff before retry to reduce contention
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 50 * attempt),
            );
            continue;
          }
          throw error;
        }
      }
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
      body: t.Object({
        partNumber: t.Integer({ minimum: 1 }),
        etag: t.String(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // POST /complete — Finalize the upload
  // -------------------------------------------------------------------------
  .post(
    "/complete",
    async ({ params }) => {
      const { organizationId, videoId } = params;

      const session = await prisma.uploadSession.findUnique({
        where: { videoId },
      });

      if (!session) {
        throw new ApiError(404, "No active upload session for this video");
      }

      const completedParts = session.completedParts as Array<{
        partNumber: number;
        etag: string;
      }>;

      if (completedParts.length !== session.totalParts) {
        throw new ApiError(
          400,
          `Upload incomplete: ${completedParts.length}/${session.totalParts} parts uploaded`,
        );
      }

      // Complete S3 multipart upload
      await s3CompleteMultipart(
        session.s3Key,
        session.s3UploadId,
        completedParts,
      );

      const storageUrl = getPublicUrl(session.s3Key);

      // Update video record
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "UPLOADED",
          storageUrl,
          fileSize: session.totalBytes,
        },
      });

      // Clean up upload session
      await prisma.uploadSession.delete({
        where: { videoId },
      });

      // Queue video processing job (thumbnail + metadata extraction)
      const job = await videoProcessingQueue.add(
        "process-video",
        {
          videoId,
          organizationId,
          s3Key: session.s3Key,
          s3Bucket: S3_BUCKET,
          s3Region: S3_REGION,
        },
        {
          jobId: `process-${videoId}`,
        },
      );

      // Update video with job ID
      // Keep status as UPLOADED — the worker will transition to PROCESSING
      // when it picks up the job, and then to COMPLETED when done.
      // Until the worker is fully implemented, this prevents videos from
      // being stuck in PROCESSING forever.
      await prisma.video.update({
        where: { id: videoId },
        data: {
          jobId: job.id,
        },
      });

      return {
        completed: true,
        storageUrl,
        jobId: job.id,
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // POST /thumbnail — Upload a client-extracted thumbnail image
  // -------------------------------------------------------------------------
  .post(
    "/thumbnail",
    async ({ params, body }) => {
      const { organizationId, videoId } = params;

      // Validate video exists and belongs to org
      const video = await prisma.video.findFirst({
        where: { id: videoId, organizationId },
      });

      if (!video) {
        throw new ApiError(404, "Video not found");
      }

      const file = body.file;

      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      if (data.length === 0) {
        throw new ApiError(400, "Empty file");
      }

      if (data.length > 5 * 1024 * 1024) {
        throw new ApiError(400, "File too large (max 5MB)");
      }

      const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
      const contentType = file.type || "image/jpeg";

      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        throw new ApiError(
          400,
          `Invalid image type '${contentType}'. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
        );
      }

      // Upload to S3
      const { key } = await uploadThumbnail(
        organizationId,
        videoId,
        data,
        contentType,
      );

      // Update video record with thumbnail key (no public URL — presigned URLs generated on read)
      await prisma.video.update({
        where: { id: videoId },
        data: {
          thumbnailKey: key,
        },
      });

      return { thumbnailKey: key };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
      body: t.Object({
        file: t.File(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // POST /abort — Cancel upload and clean up
  // -------------------------------------------------------------------------
  .post(
    "/abort",
    async ({ params }) => {
      const { videoId } = params;

      const session = await prisma.uploadSession.findUnique({
        where: { videoId },
      });

      if (!session) {
        throw new ApiError(404, "No active upload session for this video");
      }

      // Abort S3 multipart upload
      try {
        await s3AbortMultipart(session.s3Key, session.s3UploadId);
      } catch {
        // S3 abort may fail if already expired/completed — that's fine
      }

      // Delete upload session
      await prisma.uploadSession.delete({
        where: { videoId },
      });

      // Reset video status
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "PENDING",
          storageKey: null,
          storageUrl: null,
          errorMessage: null,
        },
      });

      return { aborted: true };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // GET /status — Check upload progress (for resumption)
  // -------------------------------------------------------------------------
  .get(
    "/status",
    async ({ params }) => {
      const { videoId } = params;

      const session = await prisma.uploadSession.findUnique({
        where: { videoId },
      });

      if (!session) {
        return { active: false as const };
      }

      const completedParts = session.completedParts as Array<{
        partNumber: number;
        etag: string;
      }>;

      const expired = new Date() > session.expiresAt;

      return {
        active: !expired as boolean,
        expired,
        uploadSessionId: session.id,
        s3UploadId: session.s3UploadId,
        s3Key: session.s3Key,
        partSize: session.partSize,
        totalParts: session.totalParts,
        completedParts: completedParts.map((p) => p.partNumber),
        completedCount: completedParts.length,
        totalBytes: session.totalBytes.toString(),
        uploadedBytes: session.uploadedBytes.toString(),
        expiresAt: session.expiresAt.toISOString(),
      };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
    },
  );
