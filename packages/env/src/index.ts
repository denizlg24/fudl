/**
 * Environment variable parsing utilities
 * Uses Zod for type-safe environment variable validation
 */

import { z, ZodError, ZodSchema } from "zod";

/**
 * Parse environment variables with a Zod schema
 * Throws a formatted error if validation fails
 */
export function parseEnv<T extends ZodSchema>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  try {
    return schema.parse(env);
  } catch (error) {
    if (error instanceof ZodError) {
      const formatted = error.errors
        .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(`Invalid environment variables:\n${formatted}`);
    }
    throw error;
  }
}

/**
 * Create a lazy-loaded environment config
 * Validates on first access, then caches the result
 */
export function createEnv<T extends ZodSchema>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  let cached: z.infer<T> | null = null;

  return new Proxy({} as z.infer<T>, {
    get(_, prop) {
      if (cached === null) {
        cached = parseEnv(schema, env);
      }
      return (cached as z.infer<T>)[prop as keyof z.infer<T>];
    },
  });
}

// Re-export zod for convenience
export { z } from "zod";

// Common transformers
export const port = z.coerce.number().int().positive();
export const boolean = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");
export const url = z.string().url();
export const optionalUrl = z.string().url().optional();
