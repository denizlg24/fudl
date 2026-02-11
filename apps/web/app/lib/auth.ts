import { auth } from "@repo/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Get the current session on the server side.
 * Returns null if not authenticated.
 */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 * Returns the session (guaranteed non-null).
 */
export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Get the full active organization (members, invitations, etc.).
 * Returns null if no active org is set.
 */
export async function getServerOrg() {
  return auth.api.getFullOrganization({ headers: await headers() });
}

/**
 * Get the current user's active member record (includes role).
 * Returns null if no active org.
 */
export async function getActiveMember() {
  return auth.api.getActiveMember({ headers: await headers() });
}

/**
 * List all organizations the current user belongs to.
 */
export async function listUserOrgs() {
  return auth.api.listOrganizations({ headers: await headers() });
}

/**
 * Require authentication AND an active organization.
 * Redirects to /login if not authenticated.
 * Returns null if no active org (caller handles the no-org state).
 */
export async function requireAuthWithOrg() {
  const session = await requireAuth();

  if (!session.session.activeOrganizationId) {
    return null;
  }

  const org = await getServerOrg();
  if (!org) {
    return null;
  }

  return { session, org };
}
