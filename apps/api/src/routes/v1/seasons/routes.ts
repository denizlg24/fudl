/**
 * Season Routes - v1
 * CRUD operations for seasons within an organization
 */

import { Elysia, t } from "elysia";
import { prisma } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";
import { getSignedDownloadUrl } from "../../../lib/s3";

export const seasonRoutes = new Elysia({
  prefix: "/orgs/:organizationId/seasons",
})
  .use(authPlugin)

  /**
   * GET /orgs/:organizationId/seasons
   * List all seasons for an organization
   */
  .get(
    "/",
    async ({ params }) => {
      const seasons = await prisma.season.findMany({
        where: { organizationId: params.organizationId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { games: true } },
        },
      });

      return { seasons };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
      }),
    },
  )

  /**
   * POST /orgs/:organizationId/seasons
   * Create a new season
   */
  .post(
    "/",
    async ({ params, body }) => {
      const season = await prisma.season.create({
        data: {
          name: body.name,
          organizationId: params.organizationId,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
        },
      });

      return { season };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200 }),
        startDate: t.Optional(t.String({ format: "date" })),
        endDate: t.Optional(t.String({ format: "date" })),
      }),
    },
  )

  /**
   * GET /orgs/:organizationId/seasons/:seasonId
   * Get a single season with its games (including videos, tags, presigned URLs)
   */
  .get(
    "/:seasonId",
    async ({ params }) => {
      const season = await prisma.season.findFirst({
        where: {
          id: params.seasonId,
          organizationId: params.organizationId,
        },
        include: {
          games: {
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
              tags: {
                select: {
                  tag: {
                    select: { id: true, name: true, category: true },
                  },
                },
              },
            },
          },
          _count: { select: { games: true } },
        },
      });

      if (!season) {
        throw new ApiError(404, "Season not found");
      }

      // Batch-sign all thumbnail keys across all games' videos
      const thumbnailKeys = new Set<string>();
      for (const game of season.games) {
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

      return {
        season: {
          ...season,
          games: season.games.map((game) => ({
            ...game,
            tags: game.tags.map((entry) => entry.tag),
            videos: game.videos.map((video) => ({
              id: video.id,
              status: video.status,
              thumbnailUrl: video.thumbnailKey
                ? (signedUrlMap.get(video.thumbnailKey) ?? null)
                : (video.thumbnailUrl ?? null),
            })),
          })),
        },
      };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
        seasonId: t.String(),
      }),
    },
  )

  /**
   * PATCH /orgs/:organizationId/seasons/:seasonId
   * Update a season
   */
  .patch(
    "/:seasonId",
    async ({ params, body }) => {
      const existing = await prisma.season.findFirst({
        where: {
          id: params.seasonId,
          organizationId: params.organizationId,
        },
      });

      if (!existing) {
        throw new ApiError(404, "Season not found");
      }

      const season = await prisma.season.update({
        where: { id: params.seasonId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.startDate !== undefined && {
            startDate: body.startDate ? new Date(body.startDate) : null,
          }),
          ...(body.endDate !== undefined && {
            endDate: body.endDate ? new Date(body.endDate) : null,
          }),
        },
      });

      return { season };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        seasonId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        startDate: t.Optional(t.Nullable(t.String({ format: "date" }))),
        endDate: t.Optional(t.Nullable(t.String({ format: "date" }))),
      }),
    },
  )

  /**
   * DELETE /orgs/:organizationId/seasons/:seasonId
   * Delete a season. Fails if the season has any games (restrict delete).
   */
  .delete(
    "/:seasonId",
    async ({ params }) => {
      const existing = await prisma.season.findFirst({
        where: {
          id: params.seasonId,
          organizationId: params.organizationId,
        },
        include: { _count: { select: { games: true } } },
      });

      if (!existing) {
        throw new ApiError(404, "Season not found");
      }

      if (existing._count.games > 0) {
        throw new ApiError(
          400,
          `Cannot delete a season that has ${existing._count.games} game${existing._count.games !== 1 ? "s" : ""}. Move or delete the games first.`,
        );
      }

      await prisma.season.delete({
        where: { id: params.seasonId },
      });

      return { deleted: true };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        seasonId: t.String(),
      }),
    },
  );
