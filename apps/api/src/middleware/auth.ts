/**
 * Authentication middleware using better-auth
 * Uses Elysia macro pattern (recommended for better-auth)
 */

import { Elysia } from "elysia";
import { auth } from "@repo/auth/server";

/**
 * Base auth plugin that resolves session and provides macro for auth requirements
 */
export const authPlugin = new Elysia({ name: "plugin/auth" })
  .derive({ as: "global" }, async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return {
      user: session?.user ?? null,
      session: session?.session ?? null,
    };
  })
  .macro({
    /**
     * Macro to require authentication
     * Usage: .get("/protected", handler, { auth: true })
     */
    auth(enabled: boolean) {
      if (!enabled) return;

      return {
        beforeHandle({ user, set }) {
          if (!user) {
            set.status = 401;
            return {
              error: "Unauthorized",
              message: "Authentication required",
            };
          }
        },
      };
    },
    /**
     * Macro to require organization ownership
     * Usage: .get("/org/:organizationId", handler, { isOrgOwner: true })
     */
    isOrgOwner(enabled: boolean) {
      if (!enabled) return;

      return {
        async beforeHandle({ user, request, params, query, body, set }) {
          if (!user) {
            set.status = 401;
            return {
              error: "Unauthorized",
              message: "Authentication required",
            };
          }

          const organizationId =
            (params as Record<string, string>)?.organizationId ||
            (query as Record<string, string>)?.organizationId ||
            (body as Record<string, string>)?.organizationId;

          if (!organizationId) {
            set.status = 400;
            return {
              error: "Bad Request",
              message: "Organization ID is required",
            };
          }

          const membership = await auth.api.getFullOrganization({
            headers: request.headers,
            query: { organizationId },
          });

          if (!membership) {
            set.status = 403;
            return {
              error: "Forbidden",
              message: "Not a member of this organization",
            };
          }

          const userMembership = membership.members.find(
            (m) => m.userId === user.id,
          );

          if (!userMembership || userMembership.role !== "owner") {
            set.status = 403;
            return {
              error: "Forbidden",
              message: "Must be organization owner",
            };
          }
        },
      };
    },
    /**
     * Macro to require coach-level access (owner or admin/coach role).
     * Usage: .get("/org/:organizationId", handler, { isCoach: true })
     */
    isCoach(enabled: boolean) {
      if (!enabled) return;

      return {
        async beforeHandle({ user, request, params, query, body, set }) {
          if (!user) {
            set.status = 401;
            return {
              error: "Unauthorized",
              message: "Authentication required",
            };
          }

          const organizationId =
            (params as Record<string, string>)?.organizationId ||
            (query as Record<string, string>)?.organizationId ||
            (body as Record<string, string>)?.organizationId;

          if (!organizationId) {
            set.status = 400;
            return {
              error: "Bad Request",
              message: "Organization ID is required",
            };
          }

          const membership = await auth.api.getFullOrganization({
            headers: request.headers,
            query: { organizationId },
          });

          if (!membership) {
            set.status = 403;
            return {
              error: "Forbidden",
              message: "Not a member of this organization",
            };
          }

          const userMembership = membership.members.find(
            (m) => m.userId === user.id,
          );

          if (
            !userMembership ||
            (userMembership.role !== "owner" && userMembership.role !== "admin")
          ) {
            set.status = 403;
            return {
              error: "Forbidden",
              message: "Coach-level access required",
            };
          }
        },
      };
    },
    /**
     * Macro to require organization membership
     * Usage: .get("/org/:organizationId", handler, { isOrgMember: true })
     */
    isOrgMember(enabled: boolean) {
      if (!enabled) return;

      return {
        async beforeHandle({ user, request, params, query, body, set }) {
          if (!user) {
            set.status = 401;
            return {
              error: "Unauthorized",
              message: "Authentication required",
            };
          }

          const organizationId =
            (params as Record<string, string>)?.organizationId ||
            (query as Record<string, string>)?.organizationId ||
            (body as Record<string, string>)?.organizationId;

          if (!organizationId) {
            set.status = 400;
            return {
              error: "Bad Request",
              message: "Organization ID is required",
            };
          }

          const membership = await auth.api.getFullOrganization({
            headers: request.headers,
            query: { organizationId },
          });

          if (!membership) {
            set.status = 403;
            return {
              error: "Forbidden",
              message: "Not a member of this organization",
            };
          }

          const userMembership = membership.members.find(
            (m) => m.userId === user.id,
          );

          if (!userMembership) {
            set.status = 403;
            return {
              error: "Forbidden",
              message: "Not a member of this organization",
            };
          }
        },
      };
    },
  });
