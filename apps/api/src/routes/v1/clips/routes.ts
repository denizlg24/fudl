/**
 * Clip Routes - v1
 * CRUD operations for clips within an organization.
 * Clips are time segments within footage files (Videos).
 * Each clip has a playNumber that groups clips across camera angles.
 */

import { Elysia, t } from "elysia";
import { prisma } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";
import { getSignedDownloadUrl } from "../../../lib/s3";

export const clipRoutes = new Elysia({ prefix: "/orgs/:organizationId/clips" })
  .use(authPlugin)

  /**
   * GET /orgs/:organizationId/clips
   * List clips for a game. Requires ?gameId= filter.
   * Optionally filter by ?videoId= for a specific footage file.
   * Ordered by playNumber asc.
   */
  .get(
    "/",
    async ({ params, query }) => {
      const { organizationId } = params;

      const where: {
        organizationId: string;
        video: { gameId: string };
        videoId?: string;
      } = {
        organizationId,
        video: { gameId: query.gameId },
      };

      if (query.videoId) {
        where.videoId = query.videoId;
      }

      const clips = await prisma.clip.findMany({
        where,
        orderBy: { playNumber: "asc" },
      });

      // Batch-sign thumbnail URLs
      const signedClips = await Promise.all(
        clips.map(async (clip) => {
          let thumbnailUrl: string | null = null;
          if (clip.thumbnailKey) {
            thumbnailUrl = await getSignedDownloadUrl(clip.thumbnailKey);
          }
          return {
            id: clip.id,
            videoId: clip.videoId,
            playNumber: clip.playNumber,
            title: clip.title,
            startTime: clip.startTime,
            endTime: clip.endTime,
            thumbnailUrl,
            labels: clip.labels as string[],
            metadata: clip.metadata as Record<string, unknown>,
            createdAt: clip.createdAt.toISOString(),
          };
        }),
      );

      return { clips: signedClips };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      query: t.Object({
        gameId: t.String({ minLength: 1 }),
        videoId: t.Optional(t.String()),
      }),
    },
  )

  /**
   * POST /orgs/:organizationId/clips
   * Create a new clip. Validates that the video belongs to the org.
   * Sets metadata.source = "manual" automatically.
   */
  .post(
    "/",
    async ({ params, body }) => {
      const { organizationId } = params;

      // Validate video belongs to org
      const video = await prisma.video.findFirst({
        where: {
          id: body.videoId,
          organizationId,
        },
      });

      if (!video) {
        throw new ApiError(404, "Video not found in this organization");
      }

      // Validate endTime > startTime
      if (body.endTime <= body.startTime) {
        throw new ApiError(400, "End time must be after start time");
      }

      // Validate uniqueness: no existing clip for this videoId + playNumber
      const existing = await prisma.clip.findUnique({
        where: {
          videoId_playNumber: {
            videoId: body.videoId,
            playNumber: body.playNumber,
          },
        },
      });

      if (existing) {
        throw new ApiError(
          409,
          `Play ${body.playNumber} already has a clip on this footage file`,
        );
      }

      // Merge metadata with source = "manual"
      const metadata = {
        ...(body.metadata ?? {}),
        source: "manual",
      };

      const clip = await prisma.clip.create({
        data: {
          videoId: body.videoId,
          organizationId,
          playNumber: body.playNumber,
          title: body.title ?? null,
          startTime: body.startTime,
          endTime: body.endTime,
          labels: body.labels ?? [],
          metadata,
        },
      });

      return {
        clip: {
          id: clip.id,
          videoId: clip.videoId,
          playNumber: clip.playNumber,
          title: clip.title,
          startTime: clip.startTime,
          endTime: clip.endTime,
          thumbnailUrl: null,
          labels: clip.labels as string[],
          metadata: clip.metadata as Record<string, unknown>,
          createdAt: clip.createdAt.toISOString(),
        },
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      body: t.Object({
        videoId: t.String({ minLength: 1 }),
        playNumber: t.Integer({ minimum: 1 }),
        startTime: t.Number({ minimum: 0 }),
        endTime: t.Number({ minimum: 0 }),
        title: t.Optional(t.String({ maxLength: 200 })),
        labels: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 20 })),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
    },
  )

  /**
   * GET /orgs/:organizationId/clips/:clipId
   * Get a single clip with presigned URLs.
   */
  .get(
    "/:clipId",
    async ({ params }) => {
      const clip = await prisma.clip.findFirst({
        where: {
          id: params.clipId,
          organizationId: params.organizationId,
        },
      });

      if (!clip) {
        throw new ApiError(404, "Clip not found");
      }

      let thumbnailUrl: string | null = null;
      if (clip.thumbnailKey) {
        thumbnailUrl = await getSignedDownloadUrl(clip.thumbnailKey);
      }

      return {
        clip: {
          id: clip.id,
          videoId: clip.videoId,
          playNumber: clip.playNumber,
          title: clip.title,
          startTime: clip.startTime,
          endTime: clip.endTime,
          thumbnailUrl,
          labels: clip.labels as string[],
          metadata: clip.metadata as Record<string, unknown>,
          createdAt: clip.createdAt.toISOString(),
        },
      };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
        clipId: t.String(),
      }),
    },
  )

  /**
   * PATCH /orgs/:organizationId/clips/:clipId
   * Update a clip. Cross-field endTime > startTime validation.
   */
  .patch(
    "/:clipId",
    async ({ params, body }) => {
      const clip = await prisma.clip.findFirst({
        where: {
          id: params.clipId,
          organizationId: params.organizationId,
        },
      });

      if (!clip) {
        throw new ApiError(404, "Clip not found");
      }

      // Cross-field validation: ensure endTime > startTime after update
      const newStartTime = body.startTime ?? clip.startTime;
      const newEndTime = body.endTime ?? clip.endTime;
      if (newEndTime <= newStartTime) {
        throw new ApiError(400, "End time must be after start time");
      }

      // If playNumber is changing, validate uniqueness
      if (body.playNumber !== undefined && body.playNumber !== clip.playNumber) {
        const existing = await prisma.clip.findUnique({
          where: {
            videoId_playNumber: {
              videoId: clip.videoId,
              playNumber: body.playNumber,
            },
          },
        });

        if (existing) {
          throw new ApiError(
            409,
            `Play ${body.playNumber} already has a clip on this footage file`,
          );
        }
      }

      const data: Record<string, unknown> = {};
      if (body.playNumber !== undefined) data.playNumber = body.playNumber;
      if (body.title !== undefined) data.title = body.title;
      if (body.startTime !== undefined) data.startTime = body.startTime;
      if (body.endTime !== undefined) data.endTime = body.endTime;
      if (body.labels !== undefined) data.labels = body.labels;
      if (body.metadata !== undefined) {
        // Merge with existing metadata
        data.metadata = {
          ...(clip.metadata as Record<string, unknown>),
          ...body.metadata,
        };
      }

      const updated = await prisma.clip.update({
        where: { id: params.clipId },
        data,
      });

      let thumbnailUrl: string | null = null;
      if (updated.thumbnailKey) {
        thumbnailUrl = await getSignedDownloadUrl(updated.thumbnailKey);
      }

      return {
        clip: {
          id: updated.id,
          videoId: updated.videoId,
          playNumber: updated.playNumber,
          title: updated.title,
          startTime: updated.startTime,
          endTime: updated.endTime,
          thumbnailUrl,
          labels: updated.labels as string[],
          metadata: updated.metadata as Record<string, unknown>,
          createdAt: updated.createdAt.toISOString(),
        },
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        clipId: t.String(),
      }),
      body: t.Object({
        playNumber: t.Optional(t.Integer({ minimum: 1 })),
        title: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
        startTime: t.Optional(t.Number({ minimum: 0 })),
        endTime: t.Optional(t.Number({ minimum: 0 })),
        labels: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 20 })),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
    },
  )

  /**
   * DELETE /orgs/:organizationId/clips/:clipId
   * Delete a clip. No S3 cleanup needed for manual clips.
   */
  .delete(
    "/:clipId",
    async ({ params }) => {
      const clip = await prisma.clip.findFirst({
        where: {
          id: params.clipId,
          organizationId: params.organizationId,
        },
      });

      if (!clip) {
        throw new ApiError(404, "Clip not found");
      }

      await prisma.clip.delete({
        where: { id: params.clipId },
      });

      return { deleted: true, playNumber: clip.playNumber };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        clipId: t.String(),
      }),
    },
  );
