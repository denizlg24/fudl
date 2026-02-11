/**
 * Role system for FUDL
 *
 * Maps better-auth's default roles to FUDL's domain-specific terminology:
 *   - "owner" → Owner (org creator, full control)
 *   - "admin" → Coach (can upload videos, manage games, invite members)
 *   - "member" → Player (view-only, receives feedback)
 *
 * The underlying database values remain "owner", "admin", "member" — only
 * display labels and permission helpers change.
 */

/** The raw role string stored in the database (better-auth default). */
export type DbRole = "owner" | "admin" | "member";

/** Display name mapping for each role. */
export const ROLE_DISPLAY_NAME: Record<DbRole, string> = {
  owner: "Owner",
  admin: "Coach",
  member: "Player",
} as const;

/** Returns the user-facing display name for a role. */
export function getRoleDisplayName(role: string): string {
  return ROLE_DISPLAY_NAME[role as DbRole] ?? role;
}

/**
 * Badge variant mapping for consistent styling across pages.
 * - owner → "default" (filled/primary)
 * - admin/coach → "secondary"
 * - member/player → "outline"
 */
export function roleBadgeVariant(
  role: string,
): "default" | "secondary" | "outline" {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Whether a role has coach-level permissions (can upload videos,
 * manage games, create seasons, invite members).
 * Owner inherits all coach permissions.
 */
export function isCoachRole(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Whether a role has owner-level permissions (can delete team,
 * edit team profile, manage billing).
 */
export function isOwnerRole(role: string): boolean {
  return role === "owner";
}

/**
 * The roles available for assignment when inviting or changing roles.
 * Owners cannot be assigned — only the org creator is an owner.
 */
export const ASSIGNABLE_ROLES = [
  { value: "admin" as const, label: "Coach" },
  { value: "member" as const, label: "Player" },
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]["value"];
