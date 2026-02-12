import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireAuth, getServerOrg, getActiveMember } from "../../../lib/auth";
import { NoTeamState } from "../../components/no-team-state";
import { SeasonDetailContent } from "./season-detail-content";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

async function fetchSeason(orgId: string, seasonId: string, cookie: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/seasons/${seasonId}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return data.season ?? null;
}

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  await requireAuth();
  const org = await getServerOrg();

  if (!org) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <NoTeamState message="Join or create a team to view seasons." />
      </div>
    );
  }

  const { seasonId } = await params;
  const reqHeaders = await headers();
  const cookie = reqHeaders.get("cookie") || "";

  const [season, activeMember] = await Promise.all([
    fetchSeason(org.id, seasonId, cookie),
    getActiveMember(),
  ]);

  if (!season) {
    notFound();
  }

  const role = activeMember?.role ?? "member";

  return (
    <SeasonDetailContent season={season} role={role} activeOrgId={org.id} />
  );
}
