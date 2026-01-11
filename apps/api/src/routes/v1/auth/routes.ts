/**
 * Auth routes
 * Handles better-auth API endpoints
 */

import { Elysia } from "elysia";
import { auth } from "@repo/auth/server";

export const authRoutes = new Elysia({ prefix: "/auth" }).all("/*", async ({ request }) => {
  return auth.handler(request);
});
