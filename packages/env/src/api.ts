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

  // AWS S3
  AWS_S3_BUCKET: z.string().min(1),
  AWS_S3_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
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
            (url): url is string => Boolean(url),
          )
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  },

  auth: {
    cookiePrefix: "fudl_auth",
  },

  s3: {
    bucket: apiEnv.AWS_S3_BUCKET,
    region: apiEnv.AWS_S3_REGION,
    accessKeyId: apiEnv.AWS_ACCESS_KEY_ID,
    secretAccessKey: apiEnv.AWS_SECRET_ACCESS_KEY,
  },
} as const;
