/**
 * Video Routes - v1
 * CRUD operations for videos within an organization
 *
 * Note: File upload is not implemented yet — these routes manage
 * video metadata records. Upload endpoints will be added when
 * cloud storage integration (S3 or similar) is set up.
 */

import { Elysia, t } from "elysia";
import { prisma, VideoStatus } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";

const videoStatusValues = Object.values(VideoStatus) as [string, ...string[]];

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
        },
      });

      return { videos };
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

      const video = await prisma.video.create({
        data: {
          title: body.title,
          organizationId: params.organizationId,
          gameId: body.gameId ?? null,
          uploadedById: user!.id,
          mimeType: body.mimeType ?? null,
          fileSize: body.fileSize ?? null,
          status: "PENDING",
        },
        include: {
          game: { select: { id: true, title: true } },
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return { video };
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
        fileSize: t.Optional(t.Integer({ minimum: 0 })),
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
        },
      });

      if (!video) {
        throw new ApiError(404, "Video not found");
      }

      return { video };
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
   * Update video metadata (title, game association)
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

      const video = await prisma.video.update({
        where: { id: params.videoId },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.gameId !== undefined && { gameId: body.gameId }),
        },
        include: {
          game: { select: { id: true, title: true } },
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return { video };
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

      // TODO: When cloud storage is implemented, also delete the file
      // from S3/storage before removing the database record.

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
