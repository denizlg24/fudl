/**
 * Invite Link Routes - v1
 * Secure, token-based shareable invite links for organizations
 */

import { Elysia, t } from "elysia";
import { prisma } from "@repo/db";
import { authPlugin, ApiError } from "../../../middleware";
import { auth } from "@repo/auth/server";

/**
 * Generate a cryptographically secure URL-safe token.
 * 48 random bytes → 64-char base64url string.
 */
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  // Base64url encoding (no padding, URL-safe chars)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64;
}

/**
 * Check if an invite link is valid (not expired, not revoked, uses remaining).
 */
function isLinkValid(link: {
  expiresAt: Date;
  revokedAt: Date | null;
  useCount: number;
  maxUses: number;
}): boolean {
  if (link.revokedAt) return false;
  if (link.expiresAt < new Date()) return false;
  if (link.useCount >= link.maxUses) return false;
  return true;
}

// ─── Org-scoped routes (require auth + coach-level access) ────────────────────

const orgScopedRoutes = new Elysia({
  prefix: "/orgs/:organizationId/invite-links",
})
  .use(authPlugin)

  /**
   * GET /orgs/:organizationId/invite-links
   * List all invite links for an organization (active + expired/revoked)
   */
  .get(
    "/",
    async ({ params }) => {
      const links = await prisma.inviteLink.findMany({
        where: { organizationId: params.organizationId },
        orderBy: { createdAt: "desc" },
      });

      return {
        links: links.map((link) => ({
          ...link,
          active: isLinkValid(link),
        })),
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
      }),
    },
  )

  /**
   * POST /orgs/:organizationId/invite-links
   * Create a new invite link with configurable expiry and max uses
   */
  .post(
    "/",
    async ({ params, body, user }) => {
      const token = generateToken();
      const hoursUntilExpiry = body.expiresInHours ?? 168;
      const expiresAt = new Date(
        Date.now() + hoursUntilExpiry * 60 * 60 * 1000,
      );

      const link = await prisma.inviteLink.create({
        data: {
          token,
          organizationId: params.organizationId,
          createdById: user!.id,
          role: body.role,
          maxUses: body.maxUses,
          expiresAt,
        },
      });

      return {
        link: {
          ...link,
          token,
          active: true,
        },
      };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
      }),
      body: t.Object({
        role: t.Optional(
          t.Union([t.Literal("admin"), t.Literal("member")], {
            default: "member",
          }),
        ),
        maxUses: t.Optional(
          t.Number({ minimum: 1, maximum: 1000, default: 25 }),
        ),
        expiresInHours: t.Optional(
          t.Number({ minimum: 1, maximum: 720, default: 168 }),
        ), // default 7 days, max 30 days
      }),
    },
  )

  /**
   * DELETE /orgs/:organizationId/invite-links/:linkId
   * Revoke an invite link (soft delete — sets revokedAt)
   */
  .delete(
    "/:linkId",
    async ({ params }) => {
      const link = await prisma.inviteLink.findFirst({
        where: {
          id: params.linkId,
          organizationId: params.organizationId,
        },
      });

      if (!link) {
        throw new ApiError(404, "Invite link not found");
      }

      if (link.revokedAt) {
        throw new ApiError(400, "Invite link is already revoked");
      }

      await prisma.inviteLink.update({
        where: { id: link.id },
        data: { revokedAt: new Date() },
      });

      return { success: true };
    },
    {
      isCoach: true,
      params: t.Object({
        organizationId: t.String(),
        linkId: t.String(),
      }),
    },
  );

// ─── Public token routes (no org context needed) ──────────────────────────────

const tokenRoutes = new Elysia({
  prefix: "/invite-links",
})
  .use(authPlugin)

  /**
   * GET /invite-links/:token
   * Validate a token and return minimal public info (org name).
   * Does NOT require authentication — allows the invite page to show
   * what org the user is being invited to before they log in.
   */
  .get(
    "/:token",
    async ({ params }) => {
      const link = await prisma.inviteLink.findUnique({
        where: { token: params.token },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (!link) {
        throw new ApiError(404, "Invite link not found or has expired");
      }

      if (!isLinkValid(link)) {
        throw new ApiError(
          410,
          link.revokedAt
            ? "This invite link has been revoked"
            : link.useCount >= link.maxUses
              ? "This invite link has reached its maximum number of uses"
              : "This invite link has expired",
        );
      }

      return {
        organizationName: link.organization.name,
        role: link.role,
        expiresAt: link.expiresAt,
      };
    },
    {
      params: t.Object({
        token: t.String(),
      }),
    },
  )

  /**
   * POST /invite-links/:token/accept
   * Accept an invite link: validates the token, checks the user isn't already
   * a member, adds them to the organization, and increments the use count.
   * Requires authentication.
   */
  .post(
    "/:token/accept",
    async ({ params, user, request, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized", message: "Authentication required" };
      }

      const link = await prisma.inviteLink.findUnique({
        where: { token: params.token },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (!link) {
        throw new ApiError(404, "Invite link not found or has expired");
      }

      if (!isLinkValid(link)) {
        throw new ApiError(
          410,
          link.revokedAt
            ? "This invite link has been revoked"
            : link.useCount >= link.maxUses
              ? "This invite link has reached its maximum number of uses"
              : "This invite link has expired",
        );
      }

      // Check if user is already a member of this org
      const existingMember = await prisma.member.findFirst({
        where: {
          organizationId: link.organizationId,
          userId: user.id,
        },
      });

      if (existingMember) {
        // Set the org as active and return success (idempotent)
        await auth.api.setActiveOrganization({
          headers: request.headers,
          body: { organizationId: link.organizationId },
        });

        return {
          success: true,
          alreadyMember: true,
          organizationName: link.organization.name,
          organizationId: link.organizationId,
        };
      }

      // Add user as a member via better-auth's API so session state stays consistent
      await auth.api.addMember({
        headers: request.headers,
        body: {
          organizationId: link.organizationId,
          userId: user.id,
          role: link.role as "member" | "admin",
        },
      });

      // Increment use count atomically
      await prisma.inviteLink.update({
        where: { id: link.id },
        data: { useCount: { increment: 1 } },
      });

      // Set the org as active for the user's session
      await auth.api.setActiveOrganization({
        headers: request.headers,
        body: { organizationId: link.organizationId },
      });

      return {
        success: true,
        alreadyMember: false,
        organizationName: link.organization.name,
        organizationId: link.organizationId,
      };
    },
    {
      auth: true,
      params: t.Object({
        token: t.String(),
      }),
    },
  );

// ─── Combined export ──────────────────────────────────────────────────────────

export const inviteLinkRoutes = new Elysia()
  .use(orgScopedRoutes)
  .use(tokenRoutes);
