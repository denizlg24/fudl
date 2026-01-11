/**
 * Redis connection configuration
 * Shared across queues and other Redis-dependent services
 */

import { config } from "../config";

export const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
} as const;
