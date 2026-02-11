import { requireAuth, getServerOrg, getActiveMember } from "../../lib/auth";
import { headers } from "next/headers";
import { DashboardContent } from "./dashboard-content";
import { NoTeamDashboard } from "./no-team-dashboard";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

async function fetchGames(orgId: string, seasonFilter: string, cookie: string) {
  const seasonParam = seasonFilter !== "all" ? `?seasonId=${seasonFilter}` : "";
  const res = await fetch(`${API_URL}/orgs/${orgId}/games${seasonParam}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.games || [];
}

async function fetchSeasons(orgId: string, cookie: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/seasons`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.seasons || [];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const org = await getServerOrg();

  if (!org) {
    return <NoTeamDashboard userName={session.user.name || "there"} />;
  }

  const resolvedParams = await searchParams;
  const seasonFilter =
    typeof resolvedParams.season === "string" ? resolvedParams.season : "all";

  const reqHeaders = await headers();
  const cookie = reqHeaders.get("cookie") || "";

  const [games, seasons, activeMember] = await Promise.all([
    fetchGames(org.id, seasonFilter, cookie),
    fetchSeasons(org.id, cookie),
    getActiveMember(),
  ]);

  const role = activeMember?.role ?? "member";

  return (
    <DashboardContent
      initialGames={games}
      seasons={seasons}
      role={role}
      activeOrgId={org.id}
      seasonFilter={seasonFilter}
    />
  );
}
