/**
 * Game Routes - v1
 * CRUD operations for games within an organization
 */

import { Elysia, t } from "elysia";
import { prisma } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";

export const gameRoutes = new Elysia({ prefix: "/orgs/:organizationId/games" })
  .use(authPlugin)

  /**
   * GET /orgs/:organizationId/games
   * List all games for an organization, optionally filtered by season
   */
  .get(
    "/",
    async ({ params, query }) => {
      const games = await prisma.game.findMany({
        where: {
          organizationId: params.organizationId,
          ...(query.seasonId && { seasonId: query.seasonId }),
        },
        orderBy: { date: "desc" },
        include: {
          season: { select: { id: true, name: true } },
          _count: { select: { videos: true } },
        },
      });

      return { games };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      query: t.Object({
        seasonId: t.Optional(t.String()),
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
      // Validate season belongs to same org if provided
      if (body.seasonId) {
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

      const game = await prisma.game.create({
        data: {
          title: body.title,
          organizationId: params.organizationId,
          seasonId: body.seasonId ?? null,
          opponent: body.opponent ?? null,
          date: body.date ? new Date(body.date) : null,
          location: body.location ?? null,
          notes: body.notes ?? null,
        },
        include: {
          season: { select: { id: true, name: true } },
        },
      });

      return { game };
    },
    {
      isOrgOwner: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      body: t.Object({
        title: t.String({ minLength: 1 }),
        seasonId: t.Optional(t.String()),
        opponent: t.Optional(t.String()),
        date: t.Optional(t.String({ format: "date-time" })),
        location: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    },
  )

  /**
   * GET /orgs/:organizationId/games/:gameId
   * Get a single game with its videos
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
              createdAt: true,
            },
          },
          _count: { select: { videos: true } },
        },
      });

      if (!game) {
        throw new ApiError(404, "Game not found");
      }

      return { game };
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
      if (body.seasonId !== undefined && body.seasonId !== null) {
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

      const game = await prisma.game.update({
        where: { id: params.gameId },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.seasonId !== undefined && {
            seasonId: body.seasonId,
          }),
          ...(body.opponent !== undefined && { opponent: body.opponent }),
          ...(body.date !== undefined && {
            date: body.date ? new Date(body.date) : null,
          }),
          ...(body.location !== undefined && { location: body.location }),
          ...(body.notes !== undefined && { notes: body.notes }),
        },
        include: {
          season: { select: { id: true, name: true } },
        },
      });

      return { game };
    },
    {
      isOrgOwner: true,
      params: t.Object({
        organizationId: t.String(),
        gameId: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        seasonId: t.Optional(t.Nullable(t.String())),
        opponent: t.Optional(t.Nullable(t.String())),
        date: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
        location: t.Optional(t.Nullable(t.String())),
        notes: t.Optional(t.Nullable(t.String())),
      }),
    },
  )

  /**
   * DELETE /orgs/:organizationId/games/:gameId
   * Delete a game (videos are preserved with gameId set to null)
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

      await prisma.game.delete({
        where: { id: params.gameId },
      });

      return { deleted: true };
    },
    {
      isOrgOwner: true,
      params: t.Object({
        organizationId: t.String(),
        gameId: t.String(),
      }),
    },
  );
