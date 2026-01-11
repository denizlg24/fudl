/**
 * Shared environment variables schema
 * Variables that are common across multiple packages
 */

import { z } from "zod";
import { parseEnv } from "./index";

export const sharedSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const sharedEnv = parseEnv(sharedSchema);

export type SharedEnv = z.infer<typeof sharedSchema>;
