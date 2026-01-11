/**
 * API v1 Routes
 * All versioned routes are aggregated here
 */

import { Elysia } from "elysia";
import { healthRoutes } from "./health";
import { analysisRoutes } from "./analysis";
import { authRoutes } from "./auth";

export const v1Routes = new Elysia({ prefix: "/v1" })
  .use(healthRoutes)
  .use(analysisRoutes)
  .use(authRoutes);
