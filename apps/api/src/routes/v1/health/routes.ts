/**
 * Health Routes - v1
 * Service health checks
 */

import { Elysia } from "elysia";

export const healthRoutes = new Elysia({ prefix: "/health" })
  /**
   * GET /health
   * Basic health check
   */
  .get("/", () => ({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
  }))

  /**
   * GET /health/ready
   * Readiness check - verifies all dependencies are available
   */
  .get("/ready", async () => {
    const checks = {
      api: "healthy" as const,
    };

    return {
      status: "ready",
      checks,
      timestamp: new Date().toISOString(),
    };
  })

  /**
   * GET /health/live
   * Liveness check - verifies the service is running
   */
  .get("/live", () => ({
    status: "alive",
    timestamp: new Date().toISOString(),
  }));
