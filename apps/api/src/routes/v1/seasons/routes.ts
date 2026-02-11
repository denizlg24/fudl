/**
 * Season Routes - v1
 * CRUD operations for seasons within an organization
 */

import { Elysia, t } from "elysia";
import { prisma } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";

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
   * Get a single season with its games
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
          },
          _count: { select: { games: true } },
        },
      });

      if (!season) {
        throw new ApiError(404, "Season not found");
      }

      return { season };
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
   * Delete a season (games are preserved with seasonId set to null)
   */
  .delete(
    "/:seasonId",
    async ({ params }) => {
      const existing = await prisma.season.findFirst({
        where: {
          id: params.seasonId,
          organizationId: params.organizationId,
        },
      });

      if (!existing) {
        throw new ApiError(404, "Season not found");
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
