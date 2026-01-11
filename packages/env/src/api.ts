/**
 * API environment variables
 * Used by apps/api
 */

import { z } from "zod";
import { parseEnv, port } from "./index";
import { sharedSchema } from "./shared";

export const apiSchema = sharedSchema.extend({
  // Server
  API_PORT: port.default(3002),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: port.default(6379),

  // CORS origins
  WEB_APP_URL: z.string().url().optional(),
  DOCS_APP_URL: z.string().url().optional(),
});

export const apiEnv = parseEnv(apiSchema);

export type ApiEnv = z.infer<typeof apiSchema>;

export const apiConfig = {
  port: apiEnv.API_PORT,
  env: apiEnv.NODE_ENV,
  isDev: apiEnv.NODE_ENV !== "production",
  isProd: apiEnv.NODE_ENV === "production",

  redis: {
    host: apiEnv.REDIS_HOST,
    port: apiEnv.REDIS_PORT,
  },

  cors: {
    origins:
      apiEnv.NODE_ENV === "production"
        ? [apiEnv.WEB_APP_URL, apiEnv.DOCS_APP_URL].filter(
            (url): url is string => Boolean(url)
          )
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  },

  auth: {
    cookiePrefix: "fudl_auth",
  },
} as const;
