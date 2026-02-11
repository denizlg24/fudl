/**
 * Video Routes - v1
 * CRUD operations for videos within an organization.
 * Upload lifecycle is handled by the uploads routes.
 * Deletion includes S3 cleanup of all associated objects.
 */

import { Elysia, t } from "elysia";
import { prisma, VideoStatus } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";
import {
  deletePrefix,
  getVideoPrefix,
  abortMultipartUpload,
  getSignedDownloadUrl,
} from "../../../lib/s3";

const videoStatusValues = Object.values(VideoStatus) as [string, ...string[]];

/** Tag include shape for video responses */
const tagInclude = {
  tags: {
    select: {
      tag: {
        select: { id: true, name: true, category: true },
      },
    },
  },
} as const;

export const videoRoutes = new Elysia({
  prefix: "/orgs/:organizationId/videos",
})
  .use(authPlugin)

  /**
   * GET /orgs/:organizationId/videos
   * List all videos for an organization, optionally filtered by game or status
   */
  .get(
    "/",
    async ({ params, query }) => {
      const where: {
        organizationId: string;
        gameId?: string;
        status?: VideoStatus;
      } = {
        organizationId: params.organizationId,
      };
      if (query.gameId) where.gameId = query.gameId;
      if (query.status) where.status = query.status as VideoStatus;

      const videos = await prisma.video.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          game: { select: { id: true, title: true } },
          uploadedBy: { select: { id: true, name: true, email: true } },
          ...tagInclude,
        },
      });

      const videosWithTags = await Promise.all(
        videos.map(async (video) => ({
          ...video,
          tags: video.tags.map((entry) => entry.tag),
          thumbnailUrl: video.thumbnailKey
            ? await getSignedDownloadUrl(video.thumbnailKey, 3600)
            : video.thumbnailUrl,
        })),
      );

      return { videos: videosWithTags };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      query: t.Object({
        gameId: t.Optional(t.String()),
        status: t.Optional(t.Union(videoStatusValues.map((s) => t.Literal(s)))),
      }),
    },
  )

  /**
   * POST /orgs/:organizationId/videos
   * Create a video metadata record (pre-upload step)
   */
  .post(
    "/",
    async ({ params, body, user }) => {
      // Validate game belongs to same org if provided
      if (body.gameId) {
        const game = await prisma.game.findFirst({
          where: {
            id: body.gameId,
            organizationId: params.organizationId,
          },
        });
        if (!game) {
          throw new ApiError(400, "Game not found in this organization");
        }
      }

      // Validate tags belong to same org if provided
      if (body.tagIds && body.tagIds.length > 0) {
        const validTags = await prisma.tag.count({
          where: {
            id: { in: body.tagIds },
            organizationId: params.organizationId,
          },
        });
        if (validTags !== body.tagIds.length) {
          throw new ApiError(
            400,
            "One or more tags not found in this organization",
          );
        }
      }

      const video = await prisma.video.create({
        data: {
          title: body.title,
          organizationId: params.organizationId,
          gameId: body.gameId ?? null,
          uploadedById: user!.id,
          mimeType: body.mimeType ?? null,
          fileSize: body.fileSize != null ? BigInt(body.fileSize) : null,
          status: "PENDING",
          ...(body.tagIds &&
            body.tagIds.length > 0 && {
              tags: {
                create: body.tagIds.map((tagId) => ({ tagId })),
              },
            }),
        },
        include: {
          game: { select: { id: true, title: true } },
          uploadedBy: { select: { id: true, name: true, email: true } },
          ...tagInclude,
        },
      });

      return {
        video: {
          ...video,
          tags: video.tags.map((entry) => entry.tag),
        },
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        gameId: t.Optional(t.String()),
        mimeType: t.Optional(
          t.Union([
            t.Literal("video/mp4"),
            t.Literal("video/webm"),
            t.Literal("video/quicktime"),
            t.Literal("video/x-msvideo"),
            t.Literal("video/x-matroska"),
          ]),
        ),
        fileSize: t.Optional(t.Number({ minimum: 0 })),
        tagIds: t.Optional(t.Array(t.String())),
      }),
    },
  )

  /**
   * GET /orgs/:organizationId/videos/:videoId
   * Get a single video with full details
   */
  .get(
    "/:videoId",
    async ({ params }) => {
      const video = await prisma.video.findFirst({
        where: {
          id: params.videoId,
          organizationId: params.organizationId,
        },
        include: {
          game: { select: { id: true, title: true } },
          uploadedBy: { select: { id: true, name: true, email: true } },
          ...tagInclude,
        },
      });

      if (!video) {
        throw new ApiError(404, "Video not found");
      }

      return {
        video: {
          ...video,
          tags: video.tags.map((entry) => entry.tag),
          thumbnailUrl: video.thumbnailKey
            ? await getSignedDownloadUrl(video.thumbnailKey, 3600)
            : video.thumbnailUrl,
        },
      };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
    },
  )

  /**
   * PATCH /orgs/:organizationId/videos/:videoId
   * Update video metadata (title, game association, tags)
   */
  .patch(
    "/:videoId",
    async ({ params, body }) => {
      const existing = await prisma.video.findFirst({
        where: {
          id: params.videoId,
          organizationId: params.organizationId,
        },
      });

      if (!existing) {
        throw new ApiError(404, "Video not found");
      }

      // Validate game belongs to same org if changing
      if (body.gameId !== undefined && body.gameId !== null) {
        const game = await prisma.game.findFirst({
          where: {
            id: body.gameId,
            organizationId: params.organizationId,
          },
        });
        if (!game) {
          throw new ApiError(400, "Game not found in this organization");
        }
      }

      // Validate tags belong to same org if provided
      if (body.tagIds && body.tagIds.length > 0) {
        const validTags = await prisma.tag.count({
          where: {
            id: { in: body.tagIds },
            organizationId: params.organizationId,
          },
        });
        if (validTags !== body.tagIds.length) {
          throw new ApiError(
            400,
            "One or more tags not found in this organization",
          );
        }
      }

      const video = await prisma.video.update({
        where: { id: params.videoId },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.gameId !== undefined && { gameId: body.gameId }),
          // Replace all tags if tagIds is provided
          ...(body.tagIds !== undefined && {
            tags: {
              deleteMany: {},
              create: (body.tagIds ?? []).map((tagId) => ({ tagId })),
            },
          }),
        },
        include: {
          game: { select: { id: true, title: true } },
          uploadedBy: { select: { id: true, name: true, email: true } },
          ...tagInclude,
        },
      });

      return {
        video: {
          ...video,
          tags: video.tags.map((entry) => entry.tag),
        },
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        gameId: t.Optional(t.Nullable(t.String())),
        tagIds: t.Optional(t.Array(t.String())),
      }),
    },
  )

  /**
   * DELETE /orgs/:organizationId/videos/:videoId
   * Delete a video record
   */
  .delete(
    "/:videoId",
    async ({ params }) => {
      const existing = await prisma.video.findFirst({
        where: {
          id: params.videoId,
          organizationId: params.organizationId,
        },
      });

      if (!existing) {
        throw new ApiError(404, "Video not found");
      }

      // Clean up S3 objects (original video, thumbnail, clips)
      const prefix = getVideoPrefix(params.organizationId, params.videoId);
      await deletePrefix(prefix).catch(() => {
        // S3 cleanup failure should not block deletion
      });

      // Abort any in-progress multipart upload
      const uploadSession = await prisma.uploadSession.findUnique({
        where: { videoId: params.videoId },
      });
      if (uploadSession) {
        await abortMultipartUpload(
          uploadSession.s3Key,
          uploadSession.s3UploadId,
        ).catch(() => {});
        await prisma.uploadSession.delete({
          where: { videoId: params.videoId },
        });
      }

      await prisma.video.delete({
        where: { id: params.videoId },
      });

      return { deleted: true };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        videoId: t.String(),
      }),
    },
  );
