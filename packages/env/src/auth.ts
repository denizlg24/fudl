/**
 * Auth environment variables
 * Used by @repo/auth package
 */

import { z } from "zod";
import { createEnv } from "./index";
import { sharedSchema } from "./shared";

export const authSchema = sharedSchema.extend({
  // Auth server
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  // Trusted origins
  WEB_APP_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  EMAIL_FROM: z.string().default("FUDL <onboarding@resend.dev>"),
});

export const authEnv = createEnv(authSchema);

export type AuthEnv = z.infer<typeof authSchema>;
