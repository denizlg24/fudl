/**
 * API v1 Routes
 * All versioned routes are aggregated here
 */

import { Elysia } from "elysia";
import { healthRoutes } from "./health";
import { analysisRoutes } from "./analysis";
import { authRoutes } from "./auth";
import { seasonRoutes } from "./seasons";
import { gameRoutes } from "./games";
import { videoRoutes } from "./videos";
import { inviteLinkRoutes } from "./invite-links";
import { uploadRoutes } from "./uploads";
import { tagRoutes } from "./tags";
import { clipRoutes } from "./clips";

export const v1Routes = new Elysia({ prefix: "/v1" })
  .use(healthRoutes)
  .use(analysisRoutes)
  .use(authRoutes)
  .use(seasonRoutes)
  .use(gameRoutes)
  .use(videoRoutes)
  .use(inviteLinkRoutes)
  .use(uploadRoutes)
  .use(tagRoutes)
  .use(clipRoutes);
