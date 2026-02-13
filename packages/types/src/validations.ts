// ---------------------------------------------------------------------------
// Shared Zod validation schemas — used by both client forms and API routes.
// Single source of truth for all user input validation.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { SPORTS, POSITIONS_BY_SPORT, type Sport } from "./profile";

// ---------------------------------------------------------------------------
// Common field validators (reusable building blocks)
// ---------------------------------------------------------------------------

/** Trims and enforces length constraints on a string. */
function trimmedString(min: number, max: number, label: string) {
  return z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);
}

/** Social media handle — optional, max 30 chars, alphanumeric + underscores + periods. */
const socialHandle = z
  .string()
  .trim()
  .max(30, "Handle must be at most 30 characters")
  .regex(
    /^@?[a-zA-Z0-9_.]*$/,
    "Only letters, numbers, underscores, and periods",
  );

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: trimmedString(2, 100, "Name"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export type RegisterValues = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Profile schema (unified form — replaces per-field save)
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  name: trimmedString(2, 100, "Display name"),
  bio: z.string().trim().max(500, "Bio must be at most 500 characters"),
  sport: z
    .enum(SPORTS as unknown as [string, ...string[]])
    .or(z.literal(""))
    .optional(),
  position: z.string().max(100).optional().or(z.literal("")),
  jerseyNumber: z
    .number()
    .int("Jersey number must be a whole number")
    .min(0, "Jersey number must be 0 or greater")
    .max(999, "Jersey number must be at most 999")
    .nullable()
    .optional(),
  heightCm: z
    .number()
    .int("Height must be a whole number")
    .min(50, "Height must be at least 50 cm")
    .max(300, "Height must be at most 300 cm")
    .nullable()
    .optional(),
  weightKg: z
    .number()
    .min(20, "Weight must be at least 20 kg")
    .max(500, "Weight must be at most 500 kg")
    .nullable()
    .optional(),
  dateOfBirth: z
    .string()
    .refine(
      (val) => {
        if (!val) return true; // empty is fine (optional)
        // Must be a valid ISO 8601 date string (YYYY-MM-DD or full ISO)
        const d = new Date(val);
        return !isNaN(d.getTime());
      },
      { message: "Enter a valid date" },
    )
    .refine(
      (val) => {
        if (!val) return true;
        return new Date(val) <= new Date();
      },
      { message: "Date of birth cannot be in the future" },
    )
    .optional()
    .or(z.literal("")),
  city: z.string().trim().max(100, "City must be at most 100 characters"),
  country: z.string().trim().max(100, "Country must be at most 100 characters"),
  instagramHandle: socialHandle,
  twitterHandle: socialHandle,
});

export type ProfileValues = z.infer<typeof profileSchema>;

/**
 * Cross-field validation: if a sport is selected, position must be valid for that sport.
 * Run this as a refinement after the base schema parse.
 */
export function validateProfilePosition(
  data: ProfileValues,
): string | undefined {
  if (data.sport && data.position) {
    const validPositions = POSITIONS_BY_SPORT[data.sport as Sport];
    if (validPositions && !validPositions.includes(data.position)) {
      return "Position is not valid for the selected sport";
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Forgot password / reset password schemas
// ---------------------------------------------------------------------------

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// ---------------------------------------------------------------------------
// Password change schema
// ---------------------------------------------------------------------------

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128, "New password must be at most 128 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------------------
// Team settings schemas
// ---------------------------------------------------------------------------

export const teamNameSchema = z.object({
  name: trimmedString(2, 100, "Team name"),
});

export type TeamNameValues = z.infer<typeof teamNameSchema>;

export const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["admin", "member"]),
});

export type InviteValues = z.infer<typeof inviteSchema>;

export const inviteLinkSchema = z.object({
  role: z.enum(["admin", "member"]).default("member"),
  maxUses: z.coerce
    .number()
    .int("Max uses must be a whole number")
    .min(1, "Max uses must be at least 1")
    .max(1000, "Max uses must be at most 1000")
    .default(25),
  expiresInHours: z.coerce
    .number()
    .min(1, "Expiry must be at least 1 hour")
    .max(720, "Expiry must be at most 30 days")
    .default(168),
});

export type InviteLinkValues = z.infer<typeof inviteLinkSchema>;

// ---------------------------------------------------------------------------
// Domain model schemas (for API route validation)
// ---------------------------------------------------------------------------

export const createSeasonSchema = z.object({
  name: trimmedString(1, 200, "Season name"),
  startDate: z.string().date("Invalid date format").optional(),
  endDate: z.string().date("Invalid date format").optional(),
});

export type CreateSeasonValues = z.infer<typeof createSeasonSchema>;

export const updateSeasonSchema = z.object({
  name: trimmedString(1, 200, "Season name").optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
});

export type UpdateSeasonValues = z.infer<typeof updateSeasonSchema>;

export const createGameSchema = z.object({
  title: trimmedString(1, 200, "Game title"),
  seasonId: z.string().min(1, "Season is required"),
  date: z.string().date().optional(),
  location: z
    .string()
    .trim()
    .max(200, "Location must be at most 200 characters")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be at most 2000 characters")
    .optional(),
  tagIds: z.array(z.string()).optional(),
});

export type CreateGameValues = z.infer<typeof createGameSchema>;

export const updateGameSchema = z.object({
  title: trimmedString(1, 200, "Game title").optional(),
  seasonId: z.string().min(1, "Season is required").optional(),
  date: z.string().date().nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

export type UpdateGameValues = z.infer<typeof updateGameSchema>;

const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
] as const;

export const createVideoSchema = z.object({
  title: trimmedString(1, 200, "Video title"),
  gameId: z.string().optional(),
  mimeType: z
    .enum(ALLOWED_VIDEO_MIME_TYPES as unknown as [string, ...string[]])
    .optional(),
  fileSize: z.number().int().min(0).optional(),
  tagIds: z.array(z.string()).optional(),
});

export type CreateVideoValues = z.infer<typeof createVideoSchema>;

export const updateVideoSchema = z.object({
  title: trimmedString(1, 200, "Video title").optional(),
  gameId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

export type UpdateVideoValues = z.infer<typeof updateVideoSchema>;

export const analysisVideoSchema = z.object({
  videoUrl: z.string().url("Must be a valid URL"),
});

// ---------------------------------------------------------------------------
// Clip schemas
// ---------------------------------------------------------------------------

export const createClipSchema = z
  .object({
    videoId: z.string().min(1, "Video is required"),
    playNumber: z.number().int().min(1, "Play number must be at least 1"),
    startTime: z.number().min(0, "Start time must be non-negative"),
    endTime: z.number().min(0, "End time must be non-negative"),
    title: trimmedString(1, 200, "Clip title").optional(),
    labels: z.array(z.string().max(100)).max(20).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type CreateClipValues = z.infer<typeof createClipSchema>;

export const updateClipSchema = z
  .object({
    playNumber: z.number().int().min(1).optional(),
    title: trimmedString(1, 200, "Clip title").optional().nullable(),
    startTime: z.number().min(0).optional(),
    endTime: z.number().min(0).optional(),
    labels: z.array(z.string().max(100)).max(20).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      // Only validate when both are provided — partial updates rely on server
      // merging with existing values (the API also checks the effective range)
      if (data.startTime !== undefined && data.endTime !== undefined) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    { message: "End time must be after start time", path: ["endTime"] },
  );

export type UpdateClipValues = z.infer<typeof updateClipSchema>;

// ---------------------------------------------------------------------------
// Annotation schemas
// ---------------------------------------------------------------------------

export const createAnnotationSchema = z.object({
  videoId: z.string().min(1, "Video is required"),
  timestamp: z.number().min(0, "Timestamp must be non-negative"),
  data: z.object({
    elements: z
      .array(z.record(z.string(), z.unknown()))
      .min(1, "At least one element is required"),
  }),
});

export type CreateAnnotationValues = z.infer<typeof createAnnotationSchema>;

// ---------------------------------------------------------------------------
// Setup / org creation
// ---------------------------------------------------------------------------

export const setupSchema = z.object({
  name: trimmedString(2, 100, "Team name"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(48, "Slug must be at most 48 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens only",
    ),
});

export type SetupValues = z.infer<typeof setupSchema>;
