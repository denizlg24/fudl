/**
 * Web app environment variables
 * Used by apps/web (Next.js)
 * 
 * Note: NEXT_PUBLIC_* vars are inlined at build time by Next.js,
 * so we validate them but also export direct access for client components
 */

import { z } from "zod";
import { parseEnv } from "./index";
import { sharedSchema } from "./shared";

export const webSchema = sharedSchema.extend({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3002"),
});

export const webEnv = parseEnv(webSchema);

export type WebEnv = z.infer<typeof webSchema>;

/**
 * Client-safe environment variables
 */
export const clientEnv = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
} as const;
