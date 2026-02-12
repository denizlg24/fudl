/**
 * Tag Routes - v1
 * CRUD operations for tags within an organization
 */

import { Elysia, t } from "elysia";
import { prisma, TagCategory } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";

const tagCategoryValues = Object.values(TagCategory) as [string, ...string[]];

/** Default camera angle tags to seed when an org has none */
const DEFAULT_CAMERA_ANGLES = [
  "Front View",
  "Side View",
  "End Zone",
  "Press Box",
  "Aerial/Drone",
];

export const tagRoutes = new Elysia({ prefix: "/orgs/:organizationId/tags" })
  .use(authPlugin)

  /**
   * GET /orgs/:organizationId/tags
   * List tags for an organization, optionally filtered by category
   * Auto-seeds default camera angle tags if the org has none
   */
  .get(
    "/",
    async ({ params, query }) => {
      const { organizationId } = params;

      // Auto-seed camera angle tags if needed and category filter includes them
      if (!query.category || query.category === "CAMERA_ANGLE") {
        const existingCameraAngles = await prisma.tag.count({
          where: {
            organizationId,
            category: "CAMERA_ANGLE",
          },
        });

        if (existingCameraAngles === 0) {
          await prisma.tag.createMany({
            data: DEFAULT_CAMERA_ANGLES.map((name) => ({
              name,
              category: "CAMERA_ANGLE" as TagCategory,
              organizationId,
            })),
            skipDuplicates: true,
          });
        }
      }

      const where: { organizationId: string; category?: TagCategory } = {
        organizationId,
      };
      if (query.category) {
        where.category = query.category as TagCategory;
      }

      const tags = await prisma.tag.findMany({
        where,
        orderBy: { name: "asc" },
      });

      return { tags };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      query: t.Object({
        category: t.Optional(
          t.Union(tagCategoryValues.map((v) => t.Literal(v))),
        ),
      }),
    },
  )

  /**
   * POST /orgs/:organizationId/tags
   * Create a new tag
   */
  .post(
    "/",
    async ({ params, body }) => {
      // Check for duplicate
      const existing = await prisma.tag.findUnique({
        where: {
          organizationId_category_name: {
            organizationId: params.organizationId,
            category: body.category as TagCategory,
            name: body.name.trim(),
          },
        },
      });

      if (existing) {
        // Return existing tag instead of error — idempotent behavior
        return { tag: existing };
      }

      const tag = await prisma.tag.create({
        data: {
          name: body.name.trim(),
          category: body.category as TagCategory,
          organizationId: params.organizationId,
        },
      });

      return { tag };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        category: t.Union(tagCategoryValues.map((v) => t.Literal(v))),
      }),
    },
  )

  /**
   * DELETE /orgs/:organizationId/tags/:tagId
   * Delete a tag (cascades to all join table entries)
   */
  .delete(
    "/:tagId",
    async ({ params }) => {
      const existing = await prisma.tag.findFirst({
        where: {
          id: params.tagId,
          organizationId: params.organizationId,
        },
      });

      if (!existing) {
        throw new ApiError(404, "Tag not found");
      }

      await prisma.tag.delete({
        where: { id: params.tagId },
      });

      return { deleted: true };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        tagId: t.String(),
      }),
    },
  );
