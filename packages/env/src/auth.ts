/**
 * Auth environment variables
 * Used by @repo/auth package
 */

import { z } from "zod";
import { parseEnv } from "./index";
import { sharedSchema } from "./shared";

export const authSchema = sharedSchema.extend({
  // Auth server
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  // Trusted origins
  WEB_APP_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),
});

export const authEnv = parseEnv(authSchema);

export type AuthEnv = z.infer<typeof authSchema>;
