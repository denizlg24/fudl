/**
 * Annotation Routes - v1
 * CRUD operations for video annotations within an organization.
 * Coach annotations are public (visible to org). Player annotations are private.
 */

import { Elysia, t } from "elysia";
import { prisma } from "@repo/db";
import type { AnnotationElement } from "@repo/types";
import { authPlugin, ApiError } from "../../../middleware";

export const annotationRoutes = new Elysia({
  prefix: "/orgs/:organizationId/annotations",
})
  .use(authPlugin)

  /**
   * GET /orgs/:organizationId/annotations
   * List annotations for a video. Returns all public annotations plus
   * the current user's private annotations.
   */
  .get(
    "/",
    async ({ params, query, user }) => {
      const { organizationId } = params;
      const userId = user!.id;

      const annotations = await prisma.annotation.findMany({
        where: {
          organizationId,
          videoId: query.videoId,
          OR: [
            { isPrivate: false },
            { isPrivate: true, createdById: userId },
          ],
        },
        include: {
          createdBy: { select: { name: true } },
        },
        orderBy: { timestamp: "asc" },
      });

      return {
        annotations: annotations.map((ann) => ({
          id: ann.id,
          videoId: ann.videoId,
          timestamp: ann.timestamp,
          data: ann.data as { elements: AnnotationElement[] },
          isPrivate: ann.isPrivate,
          createdById: ann.createdById,
          createdByName: ann.createdBy.name,
          createdAt: ann.createdAt.toISOString(),
        })),
      };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      query: t.Object({
        videoId: t.String({ minLength: 1 }),
      }),
    },
  )

  /**
   * POST /orgs/:organizationId/annotations
   * Create an annotation. Privacy is auto-determined by role:
   * coaches (owner/admin) create public annotations, players create private ones.
   */
  .post(
    "/",
    async ({ params, body, user }) => {
      const { organizationId } = params;
      const userId = user!.id;

      // Validate video belongs to org
      const video = await prisma.video.findFirst({
        where: { id: body.videoId, organizationId },
      });

      if (!video) {
        throw new ApiError(404, "Video not found in this organization");
      }

      // Determine privacy from user's role in the org
      const membership = await prisma.member.findFirst({
        where: { organizationId, userId },
      });
      const role = membership?.role ?? "member";
      const isPrivate = role === "member"; // players get private annotations

      const annotation = await prisma.annotation.create({
        data: {
          videoId: body.videoId,
          organizationId,
          createdById: userId,
          timestamp: body.timestamp,
          data: body.data as object,
          isPrivate,
        },
        include: {
          createdBy: { select: { name: true } },
        },
      });

      return {
        annotation: {
          id: annotation.id,
          videoId: annotation.videoId,
          timestamp: annotation.timestamp,
          data: annotation.data as { elements: AnnotationElement[] },
          isPrivate: annotation.isPrivate,
          createdById: annotation.createdById,
          createdByName: annotation.createdBy.name,
          createdAt: annotation.createdAt.toISOString(),
        },
      };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      body: t.Object({
        videoId: t.String({ minLength: 1 }),
        timestamp: t.Number({ minimum: 0 }),
        data: t.Object({
          elements: t.Array(t.Record(t.String(), t.Unknown()), { minItems: 1 }),
        }),
      }),
    },
  )

  /**
   * DELETE /orgs/:organizationId/annotations/:annotationId
   * Delete an annotation. Coaches can delete any public annotation.
   * Players can only delete their own private annotations.
   */
  .delete(
    "/:annotationId",
    async ({ params, user }) => {
      const { organizationId, annotationId } = params;
      const userId = user!.id;

      const annotation = await prisma.annotation.findFirst({
        where: { id: annotationId, organizationId },
      });

      if (!annotation) {
        throw new ApiError(404, "Annotation not found");
      }

      // Determine user's role
      const membership = await prisma.member.findFirst({
        where: { organizationId, userId },
      });
      const role = membership?.role ?? "member";
      const isCoach = role === "owner" || role === "admin";

      if (annotation.isPrivate) {
        // Private annotation: only the creator can delete
        if (annotation.createdById !== userId) {
          throw new ApiError(403, "You can only delete your own annotations");
        }
      } else {
        // Public annotation: only coaches can delete
        if (!isCoach) {
          throw new ApiError(403, "Coach-level access required to delete team annotations");
        }
      }

      await prisma.annotation.delete({
        where: { id: annotationId },
      });

      return { deleted: true };
    },
    {
      isOrgMember: true,
      params: t.Object({
        organizationId: t.String(),
        annotationId: t.String(),
      }),
    },
  );
