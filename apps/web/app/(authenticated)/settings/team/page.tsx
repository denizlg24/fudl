import { requireAuth, getServerOrg, getActiveMember } from "../../../lib/auth";
import { headers } from "next/headers";
import {
  TeamSettingsContent,
  type MemberData,
  type InvitationData,
  type InviteLinkData,
} from "./team-content";
import { NoTeamState } from "../../components/no-team-state";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

async function fetchInviteLinks(
  orgId: string,
  cookie: string,
): Promise<InviteLinkData[]> {
  try {
    const res = await fetch(`${API_URL}/orgs/${orgId}/invite-links`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.links || [];
  } catch {
    return [];
  }
}

export default async function TeamSettingsPage() {
  const session = await requireAuth();
  const [org, activeMember] = await Promise.all([
    getServerOrg(),
    getActiveMember(),
  ]);

  if (!org) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <NoTeamState message="You need to be part of a team to access team settings." />
      </div>
    );
  }

  const reqHeaders = await headers();
  const cookie = reqHeaders.get("cookie") || "";

  const inviteLinks = await fetchInviteLinks(org.id, cookie);

  const currentMemberRole = activeMember?.role ?? "member";

  const members: MemberData[] = (org.members ?? []).map((m) => {
    const member = m as Record<string, unknown>;
    const user = (member.user as Record<string, unknown>) ?? {};
    return {
      id: m.id,
      role: m.role,
      createdAt:
        m.createdAt instanceof Date
          ? m.createdAt.toISOString()
          : String(m.createdAt),
      user: {
        id: (user.id as string) ?? m.userId,
        name: (user.name as string) ?? "",
        email: (user.email as string) ?? "",
        image: (user.image as string) ?? null,
      },
    };
  });

  const invitations: InvitationData[] = (org.invitations ?? []).map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    status: inv.status,
    expiresAt:
      inv.expiresAt instanceof Date
        ? inv.expiresAt.toISOString()
        : String(inv.expiresAt),
  }));

  return (
    <TeamSettingsContent
      initialData={{
        members,
        invitations,
        inviteLinks,
        currentMemberRole,
        orgId: org.id,
        orgName: org.name,
        orgSlug: org.slug,
        orgCreatedAt:
          org.createdAt instanceof Date
            ? org.createdAt.toISOString()
            : String(org.createdAt),
        currentUserId: session.user.id,
      }}
    />
  );
}
