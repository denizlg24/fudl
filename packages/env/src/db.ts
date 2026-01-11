/**
 * Database environment variables
 * Used by @repo/db package
 */

import { z } from "zod";
import { parseEnv } from "./index";
import { sharedSchema } from "./shared";

export const dbSchema = sharedSchema.extend({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

export const dbEnv = parseEnv(dbSchema);

export type DbEnv = z.infer<typeof dbSchema>;
