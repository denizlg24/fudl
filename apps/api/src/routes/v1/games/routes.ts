/**
 * Game Routes - v1
 * CRUD operations for games within an organization
 */

import { Elysia, t } from "elysia";
import { prisma } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";
import {
  deletePrefix,
  getVideoPrefix,
  abortMultipartUpload,
  getSignedDownloadUrl,
} from "../../../lib/s3";

/** Tag include shape for game responses */
const tagInclude = {
  tags: {
    select: {
      tag: {
        select: { id: true, name: true, category: true },
      },
    },
  },
} as const;

export const gameRoutes = new Elysia({ prefix: "/orgs/:organizationId/games" })
  .use(authPlugin)

  /**
   * GET /orgs/:organizationId/games
   * List all games for an organization, optionally filtered by season or tag
   */
  .get(
    "/",
    async ({ params, query }) => {
      const games = await prisma.game.findMany({
        where: {
          organizationId: params.organizationId,
          ...(query.seasonId && { seasonId: query.seasonId }),
          ...(query.tagId && { tags: { some: { tagId: query.tagId } } }),
        },
        orderBy: { date: "desc" },
        include: {
          season: { select: { id: true, name: true } },
          videos: {
            select: {
              id: true,
              status: true,
              thumbnailKey: true,
              thumbnailUrl: true,
            },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { videos: true } },
          ...tagInclude,
        },
      });

      // Collect all unique thumbnail keys across all games' videos,
      // sign them in a single batch, then map results back. This avoids
      // N+1 per-video signing calls that would dominate response time.
      const thumbnailKeys = new Set<string>();
      for (const game of games) {
        for (const video of game.videos) {
          if (video.thumbnailKey) {
            thumbnailKeys.add(video.thumbnailKey);
          }
        }
      }

      const signedUrlMap = new Map<string, string>();
      if (thumbnailKeys.size > 0) {
        const entries = Array.from(thumbnailKeys);
        const signedUrls = await Promise.all(
          entries.map((key) => getSignedDownloadUrl(key, 3600)),
        );
        for (let i = 0; i < entries.length; i++) {
          signedUrlMap.set(entries[i], signedUrls[i]);
        }
      }

      const gamesWithTags = games.map((game) => ({
        ...game,
        tags: game.tags.map((entry) => entry.tag),
        videos: game.videos.map((video) => ({
          id: video.id,
          status: video.status,
          thumbnailUrl: video.thumbnailKey
            ? (signedUrlMap.get(video.thumbnailKey) ?? null)
            : (video.thumbnailUrl ?? null),
        })),
      }));

      return { games: gamesWithTags };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      query: t.Object({
        seasonId: t.Optional(t.String()),
        tagId: t.Optional(t.String()),
      }),
    },
  )

  /**
   * POST /orgs/:organizationId/games
   * Create a new game
   */
  .post(
    "/",
    async ({ params, body }) => {
      // Validate season belongs to same org (required)
      const season = await prisma.season.findFirst({
        where: {
          id: body.seasonId,
          organizationId: params.organizationId,
        },
      });
      if (!season) {
        throw new ApiError(400, "Season not found in this organization");
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

      const game = await prisma.game.create({
        data: {
          title: body.title,
          organizationId: params.organizationId,
          seasonId: body.seasonId,
          date: body.date ? new Date(body.date) : null,
          location: body.location ?? null,
          notes: body.notes ?? null,
          ...(body.tagIds &&
            body.tagIds.length > 0 && {
              tags: {
                create: body.tagIds.map((tagId) => ({ tagId })),
              },
            }),
        },
        include: {
          season: { select: { id: true, name: true } },
          ...tagInclude,
        },
      });

      return {
        game: {
          ...game,
          tags: game.tags.map((entry) => entry.tag),
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
        seasonId: t.String({ minLength: 1 }),
        date: t.Optional(t.String({ format: "date" })),
        location: t.Optional(t.String({ maxLength: 200 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
        tagIds: t.Optional(t.Array(t.String())),
      }),
    },
  )

  /**
   * GET /orgs/:organizationId/games/:gameId
   * Get a single game with its videos (including presigned playback URLs)
   */
  .get(
    "/:gameId",
    async ({ params }) => {
      const game = await prisma.game.findFirst({
        where: {
          id: params.gameId,
          organizationId: params.organizationId,
        },
        include: {
          season: { select: { id: true, name: true } },
          videos: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              status: true,
              mimeType: true,
              fileSize: true,
              durationSecs: true,
              thumbnailKey: true,
              storageKey: true,
              createdAt: true,
              tags: {
                select: {
                  tag: {
                    select: { id: true, name: true, category: true },
                  },
                },
              },
            },
          },
          _count: { select: { videos: true } },
          ...tagInclude,
        },
      });

      if (!game) {
        throw new ApiError(404, "Game not found");
      }

      // Batch-sign all S3 keys (thumbnails + video files) in a single Promise.all
      const keysToSign = new Set<string>();
      for (const video of game.videos) {
        if (video.thumbnailKey) keysToSign.add(video.thumbnailKey);
        if (video.storageKey) keysToSign.add(video.storageKey);
      }

      const signedUrlMap = new Map<string, string>();
      if (keysToSign.size > 0) {
        const entries = Array.from(keysToSign);
        const signedUrls = await Promise.all(
          entries.map((key) => getSignedDownloadUrl(key, 3600)),
        );
        for (let i = 0; i < entries.length; i++) {
          signedUrlMap.set(entries[i], signedUrls[i]);
        }
      }

      return {
        game: {
          ...game,
          tags: game.tags.map((entry) => entry.tag),
          videos: game.videos.map((video) => ({
            id: video.id,
            title: video.title,
            status: video.status,
            mimeType: video.mimeType,
            fileSize: video.fileSize?.toString() ?? null,
            durationSecs: video.durationSecs,
            createdAt: video.createdAt,
            thumbnailUrl: video.thumbnailKey
              ? (signedUrlMap.get(video.thumbnailKey) ?? null)
              : null,
            storageUrl: video.storageKey
              ? (signedUrlMap.get(video.storageKey) ?? null)
              : null,
            tags: video.tags.map((entry) => entry.tag),
          })),
        },
      };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
        gameId: t.String(),
      }),
    },
  )

  /**
   * PATCH /orgs/:organizationId/games/:gameId
   * Update a game
   */
  .patch(
    "/:gameId",
    async ({ params, body }) => {
      const existing = await prisma.game.findFirst({
        where: {
          id: params.gameId,
          organizationId: params.organizationId,
        },
      });

      if (!existing) {
        throw new ApiError(404, "Game not found");
      }

      // Validate season belongs to same org if changing
      if (body.seasonId !== undefined) {
        const season = await prisma.season.findFirst({
          where: {
            id: body.seasonId,
            organizationId: params.organizationId,
          },
        });
        if (!season) {
          throw new ApiError(400, "Season not found in this organization");
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

      const game = await prisma.game.update({
        where: { id: params.gameId },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.seasonId !== undefined && {
            seasonId: body.seasonId,
          }),
          ...(body.date !== undefined && {
            date: body.date ? new Date(body.date) : null,
          }),
          ...(body.location !== undefined && { location: body.location }),
          ...(body.notes !== undefined && { notes: body.notes }),
          // Replace all tags if tagIds is provided
          ...(body.tagIds !== undefined && {
            tags: {
              deleteMany: {},
              create: (body.tagIds ?? []).map((tagId) => ({ tagId })),
            },
          }),
        },
        include: {
          season: { select: { id: true, name: true } },
          ...tagInclude,
        },
      });

      return {
        game: {
          ...game,
          tags: game.tags.map((entry) => entry.tag),
        },
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        gameId: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        seasonId: t.Optional(t.String({ minLength: 1 })),
        date: t.Optional(t.Nullable(t.String({ format: "date" }))),
        location: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
        notes: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
        tagIds: t.Optional(t.Array(t.String())),
      }),
    },
  )

  /**
   * DELETE /orgs/:organizationId/games/:gameId
   * Delete a game and all associated videos + S3 objects
   */
  .delete(
    "/:gameId",
    async ({ params }) => {
      const existing = await prisma.game.findFirst({
        where: {
          id: params.gameId,
          organizationId: params.organizationId,
        },
      });

      if (!existing) {
        throw new ApiError(404, "Game not found");
      }

      // Find all videos associated with this game
      const videos = await prisma.video.findMany({
        where: { gameId: params.gameId },
        select: { id: true },
      });

      // Clean up each video's S3 objects + upload sessions
      await Promise.all(
        videos.map(async (video) => {
          // Delete all S3 objects under this video's prefix
          const prefix = getVideoPrefix(params.organizationId, video.id);
          await deletePrefix(prefix).catch(() => {
            // S3 cleanup failure should not block deletion
          });

          // Abort any in-progress multipart upload
          const uploadSession = await prisma.uploadSession.findUnique({
            where: { videoId: video.id },
          });
          if (uploadSession) {
            await abortMultipartUpload(
              uploadSession.s3Key,
              uploadSession.s3UploadId,
            ).catch(() => {});
            await prisma.uploadSession.delete({
              where: { videoId: video.id },
            });
          }
        }),
      );

      // Delete all video records, then the game in a transaction
      await prisma.$transaction([
        prisma.video.deleteMany({ where: { gameId: params.gameId } }),
        prisma.game.delete({ where: { id: params.gameId } }),
      ]);

      return { deleted: true };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        gameId: t.String(),
      }),
    },
  );
